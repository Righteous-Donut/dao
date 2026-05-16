import { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, arbitrum, hardhat } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers } from "ethers";
import "../styles/App.css";

import Navigation from "./Navigation";
import Create from "./Create";
import Proposals from "./Proposals";
import Loading from "./Loading";

import DAO_ABI from "../abis/DAO.json";
import TOKEN_ABI from "../abis/Token.json";
import config from "../config.json";

const queryClient = new QueryClient();

const ALCHEMY_KEY = process.env.REACT_APP_ALCHEMY_API_KEY;

const RPC_URLS = {
  [mainnet.id]: "https://ethereum-rpc.publicnode.com",
  [arbitrum.id]: ALCHEMY_KEY
    ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : "https://arb1.arbitrum.io/rpc",
  [hardhat.id]: "http://127.0.0.1:8545",
};

const wagmiConfig = createConfig({
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "Easy DAO",
      jsonRpcUrl: RPC_URLS[mainnet.id],
    }),
  ],
  chains: [mainnet, arbitrum, hardhat],
  transports: {
    [mainnet.id]: http(RPC_URLS[mainnet.id]),
    [arbitrum.id]: http(RPC_URLS[arbitrum.id]),
    [hardhat.id]: http(RPC_URLS[hardhat.id]),
  },
});

function pickDefaultChainId() {
  if (config["42161"]?.dao?.address) return 42161;
  if (config["1"]?.dao?.address) return 1;
  if (config["31337"]?.dao?.address) return 31337;
  return 42161;
}

function makeReadProvider(chainId) {
  const rpcUrl = RPC_URLS[Number(chainId)];
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl);
}

function App() {
  const [walletProvider, setWalletProvider] = useState(null);
  const [readProvider, setReadProvider] = useState(null);

  const [dao, setDao] = useState(null);
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  const [account, setAccount] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [quorum, setQuorum] = useState(0n);

  const [chainId, setChainId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [unsupportedNetwork, setUnsupportedNetwork] = useState(false);
  const [unsupportedReason, setUnsupportedReason] = useState("");

  const [canVote, setCanVote] = useState(false);
  const [votingPower, setVotingPower] = useState("0");

  const initProviders = async () => {
    let targetChainId = pickDefaultChainId();

    if (window.ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const network = await browserProvider.getNetwork();

        targetChainId = Number(network.chainId);

        setWalletProvider(browserProvider);
        setChainId(targetChainId);
      } catch (err) {
        console.warn("Wallet provider detection failed:", err);
        setWalletProvider(null);
        setChainId(targetChainId);
      }
    } else {
      setWalletProvider(null);
      setChainId(targetChainId);
    }

    const rp = makeReadProvider(targetChainId);
    setReadProvider(rp);
    setIsLoading(true);
  };

  const loadBlockchainData = async () => {
    try {
      setUnsupportedNetwork(false);
      setUnsupportedReason("");

      if (!chainId) return;

      const rp = makeReadProvider(chainId);

      if (!rp) {
        setUnsupportedNetwork(true);
        setUnsupportedReason(
          "Unsupported network. Please switch to Localhost (31337), Arbitrum One (42161), or Ethereum Mainnet (1)."
        );
        return;
      }

      setReadProvider(rp);

      const net = config[String(chainId)];

      if (!net?.dao?.address) {
        setUnsupportedNetwork(true);
        setUnsupportedReason("No DAO address in config for this network.");
        return;
      }

      const daoCode = await rp.getCode(net.dao.address);

      if (daoCode === "0x") {
        setUnsupportedNetwork(true);
        setUnsupportedReason(
          `No contract code at DAO ${net.dao.address} on chain ${chainId}.`
        );
        return;
      }

      const daoRead = new ethers.Contract(net.dao.address, DAO_ABI, rp);
      setDao(daoRead);

      let user = null;

      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        if (accounts?.[0]) {
          user = ethers.getAddress(accounts[0]);
          setAccount(user);
        }
      }

      let tokenAddress = net.token?.address;

      if (!tokenAddress && daoRead.token) {
        tokenAddress = await daoRead.token();
      }

      if (!tokenAddress) {
        setUnsupportedNetwork(true);
        setUnsupportedReason("Token address missing in config and DAO.");
        return;
      }

      const tokenCode = await rp.getCode(tokenAddress);

      if (tokenCode === "0x") {
        setUnsupportedNetwork(true);
        setUnsupportedReason(
          `No contract code at Token ${tokenAddress} on chain ${chainId}.`
        );
        return;
      }

      if (user) {
        const token = new ethers.Contract(tokenAddress, TOKEN_ABI, rp);
        const balance = await token.balanceOf(user);

        setCanVote(balance > 0n);
        setVotingPower(ethers.formatUnits(balance, 18));
      } else {
        setCanVote(false);
        setVotingPower("0");
      }

      const daoAddress = await daoRead.getAddress();
      const treasury = await rp.getBalance(daoAddress);
      setTreasuryBalance(ethers.formatEther(treasury));

      const count = await daoRead.proposalCount();
      const proposalItems = [];

      for (let i = 1n; i <= count; i++) {
        const proposal = await daoRead.proposals(i);
        proposalItems.push(proposal);
      }

      setProposals(proposalItems);
      setQuorum(await daoRead.quorum());
    } catch (err) {
      console.error("loadBlockchainData error:", err);

      setUnsupportedNetwork(true);
      setUnsupportedReason(
        err?.error?.message ||
          err?.reason ||
          err?.shortMessage ||
          err?.message ||
          "Failed to load blockchain data."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initProviders();
  }, []);

  useEffect(() => {
    if (readProvider && chainId) {
      setIsLoading(true);
    }
  }, [readProvider, chainId]);

  useEffect(() => {
  if (isLoading) {
    loadBlockchainData();
  }

// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLoading]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = () => {
      initProviders();
    };

    const handleAccountsChanged = () => {
      setIsLoading(true);
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider chains={[mainnet, arbitrum, hardhat]}>
          <Container>
            <Navigation account={account} />

            <h1 className="my-4 text-center">Welcome to our DAO!</h1>

            {unsupportedNetwork && (
              <div
                className="alert alert-warning text-center my-3"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {unsupportedReason}
              </div>
            )}

            {!unsupportedNetwork && (
              <p className="text-center">
                <strong>Your voting power:</strong> {votingPower} TOKENS
              </p>
            )}

            {isLoading ? (
              <Loading />
            ) : (
              <>
                <Create
                  provider={walletProvider}
                  dao={dao}
                  setIsLoading={setIsLoading}
                />

                <hr />

                <p className="text-center">
                  <strong>Treasury Balance:</strong> {treasuryBalance} ETH
                </p>

                <hr />

                <Proposals
                  provider={walletProvider}
                  dao={dao}
                  proposals={proposals}
                  quorum={quorum}
                  canVote={canVote}
                  setIsLoading={setIsLoading}
                />
              </>
            )}
          </Container>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default App;
