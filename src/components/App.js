import { useEffect, useState } from 'react'
import { Container } from 'react-bootstrap'
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia, hardhat } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers } from 'ethers'
import '../styles/App.css';

import Navigation from './Navigation';
import Create from './Create';
import Proposals from './Proposals';
import Loading from './Loading';

// ABIs
import DAO_ABI from '../abis/DAO.json'
import TOKEN_ABI from '../abis/Token.json'

// Config
import config from '../config.json';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "DAO App",
      jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
    }),
  ],
  chains: [mainnet, sepolia, hardhat],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

// ---------- helpers ----------
const ALCHEMY = (id) =>
  id === sepolia.id
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`
    : `https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`;

/** Choose a default chain to read from when no wallet is connected. */
function pickDefaultChainId() {
  if (config["11155111"]?.dao?.address) return 11155111; // Sepolia
  if (config["1"]?.dao?.address) return 1;                // Mainnet
  return 11155111; // sensible default
}

function App() {
  // MetaMask provider for WRITES
  const [walletProvider, setWalletProvider] = useState(null)
  // Static JSON-RPC provider for READS (prevents “invalid block tag”)
  const [readProvider, setReadProvider] = useState(null)

  const [dao, setDao] = useState(null)
  const [treasuryBalance, setTreasuryBalance] = useState("0")
  const [account, setAccount] = useState(null)
  const [proposals, setProposals] = useState([])
  const [quorum, setQuorum] = useState(null)

  const [chainId, setChainId] = useState(null);
  const [isLoading, setIsLoading] = useState(true)
  const [unsupportedNetwork, setUnsupportedNetwork] = useState(false);
  const [unsupportedReason, setUnsupportedReason] = useState("");

  const [canVote, setCanVote] = useState(false)
  const [votingPower, setVotingPower] = useState("0")

  const initProviders = async () => {
    // READ provider is always available (no wallet required)
    let targetChainId = pickDefaultChainId();
    let rp = new ethers.providers.JsonRpcProvider(ALCHEMY(targetChainId));

      // If a wallet exists, prefer its chain for reads too
    if (window?.ethereum) {
      try {
        // Use "any" to avoid “could not detect network” on initial load/chain switch
        const wp = new ethers.providers.Web3Provider(window.ethereum, 'any');
        const net = await wp.getNetwork();                 // may still work without requesting accounts
        targetChainId = net.chainId;
        rp = new ethers.providers.JsonRpcProvider(ALCHEMY(targetChainId));
        setWalletProvider(wp);
        setChainId(net.chainId);
      } catch (e) {
        // If detection fails (no wallet or blocked), we still have rp for reads
        setWalletProvider(null);
        setChainId(targetChainId);
      }
    } else {
      setChainId(targetChainId);
    }

    setReadProvider(rp);
  };

    
  const makeReadProvider = (id) => {
    if (id === hardhat.id) return new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
    if (id === sepolia.id) return new ethers.providers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`)
    if (id === mainnet.id) return new ethers.providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`)
    return null
  }

  const loadBlockchainData = async () => {
    try {
      // 1) MetaMask provider for writes
      const walletProv = new ethers.providers.Web3Provider(window.ethereum)
      setWalletProvider(walletProv)

      const network = await walletProv.getNetwork()
      setChainId(network.chainId)

      // 2) Static JSON-RPC provider for reads
      const rp = makeReadProvider(network.chainId)
      if (!rp) {
        setUnsupportedNetwork(true)
        setUnsupportedReason("Unsupported network. Please switch to Localhost (31337) or Sepolia (11155111).")
        setIsLoading(false)
        return
      }
      setReadProvider(rp)

      const net = config[network.chainId]
      if (!net?.dao?.address) {
        setUnsupportedNetwork(true)
        setUnsupportedReason("No DAO address in config for this network.")
        setIsLoading(false)
        return
      }

      // Validate contracts exist on-chain (prevents MetaMask “circuit breaker”)
      const daoCode = await rp.getCode(net.dao.address)
      if (daoCode === '0x') {
        setUnsupportedNetwork(true)
        setUnsupportedReason(`No contract code at DAO ${net.dao.address} on chain ${network.chainId}.`)
        setIsLoading(false)
        return
      }

      const daoRead = new ethers.Contract(net.dao.address, DAO_ABI, rp)
      setDao(daoRead)

      const [acc] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const user = ethers.utils.getAddress(acc)
      setAccount(user)

      // Resolve & validate token
      const tokenAddress = net.token?.address || (await daoRead.token?.())
      if (!tokenAddress) {
        setUnsupportedNetwork(true)
        setUnsupportedReason("Token address missing in config and DAO.")
        setIsLoading(false)
        return
      }
      const tokenCode = await rp.getCode(tokenAddress)
      if (tokenCode === '0x') {
        setUnsupportedNetwork(true)
        setUnsupportedReason(`No contract code at Token ${tokenAddress} on chain ${network.chainId}.`)
        setCanVote(false)
      } else {
        const token = new ethers.Contract(tokenAddress, TOKEN_ABI, rp)
        const bal = await token.balanceOf(user) // READ via static RPC
        setCanVote(ethers.BigNumber.from(bal).gt(0))
        setVotingPower(ethers.utils.formatUnits(bal, 18))
      }

      // Treasury (READ via static RPC)
      const tb = await rp.getBalance(daoRead.address)
      setTreasuryBalance(ethers.utils.formatUnits(tb, 18))

      // Proposals (READ via static RPC)
      const count = await daoRead.proposalCount()
      const items = []
      for (let i = 0; i < count; i++) {
        const p = await daoRead.proposals(i + 1)
        items.push(p)
      }
      setProposals(items)

      setQuorum(await daoRead.quorum())
    } catch (err) {
      console.error("loadBlockchainData error:", err)
      setUnsupportedNetwork(true)
      setUnsupportedReason(err?.error?.message || err?.reason || err?.message || "Failed to load blockchain data.")
    } finally {
      setIsLoading(false)
    }
  }

  // Re-init providers once on mount
  useEffect(() => { initProviders(); }, []);
  // Load data when providers/chain known
  useEffect(() => { if (readProvider && chainId) setIsLoading(true); }, [readProvider, chainId]);
  // Auto-refresh when account or chain changes (keeps providers in sync with node)
  useEffect(() => {
    if (isLoading) loadBlockchainData();
  }, [isLoading]);

  useEffect(() => {
    if (!window.ethereum) return
    const onChain = () => setIsLoading(true)
    const onAccounts = () => setIsLoading(true)
    window.ethereum.on('chainChanged', onChain)
    window.ethereum.on('accountsChanged', onAccounts)
    return () => {
      window.ethereum.removeListener('chainChanged', onChain)
      window.ethereum.removeListener('accountsChanged', onAccounts)
    }
  }, [])

  

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider chains={[mainnet, sepolia, hardhat]}>
          <Container>
            <Navigation account={account} />
            <h1 className='my-4 text-center'>Welcome to our DAO!</h1>

            {unsupportedNetwork && (
              <div className="alert alert-warning text-center my-3" style={{ whiteSpace: 'pre-wrap' }}>
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
                  provider={walletProvider}  // writes (may be null → UI stays read-only)
                  dao={dao}
                  setIsLoading={setIsLoading}
                />

                <hr />
                <p className='text-center'><strong>Treasury Balance:</strong> {treasuryBalance} ETH</p>
                <hr />

                <Proposals
                  provider={walletProvider}  // writes
                  dao={dao}                  // reads via readProvider
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
