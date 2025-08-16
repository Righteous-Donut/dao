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

// Components
import Navigation from './Navigation';
import Create from './Create';
import Proposals from './Proposals';
import Loading from './Loading';

// ABIs: Import your contract ABIs here
import DAO_ABI from '../abis/DAO.json'

// Config: Import your network config here
import config from '../config.json';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "Crowdsale App",
      jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
    }),
  ],
  chains: [mainnet, sepolia, hardhat],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`),
    [hardhat.id]: http(), // localhost:8545
  },
});

function App() {
  const [provider, setProvider] = useState(null)
  const [dao, setDao] = useState(null)
  const [treasuryBalance, setTreasuryBalance] = useState(0)

  const [account, setAccount] = useState(null)

  const [proposals, setProposals] = useState(null)
  const [quorum, setQuorum] = useState(null)

  const [isLoading, setIsLoading] = useState(true)

  const loadBlockchainData = async () => {
      // Initiate provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)

      // Initiate contracts
      const dao = new ethers.Contract(config[31337].dao.address, DAO_ABI, provider)
      setDao(dao)

      // Fetch treasury balance
      let treasuryBalance = await provider.getBalance(dao.address)
      treasuryBalance = ethers.utils.formatUnits(treasuryBalance, 18)
      setTreasuryBalance(treasuryBalance)

      // Fetch accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const account = ethers.utils.getAddress(accounts[0])
      setAccount(account)

      // Fetch proposals count
      const count = await dao.proposalCount()
      const items = []

      for(var i = 0; i < count; i++) {
        const proposal = await dao.proposals(i + 1)
        items.push(proposal)
      }

      setProposals(items)

      // Fetch quorum
      setQuorum(await dao.quorum())

      setIsLoading(false)
  }
    

  useEffect(() => {
    if (isLoading) {
      loadBlockchainData();
    }
  }, [isLoading]);

  return(
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider chains={[mainnet, sepolia, hardhat]}>
          <Container>
            <Navigation account={account} />

            <h1 className='my-4 text-center'>Welcome to our DAO!</h1>

            {isLoading ? (
              <Loading />
            ) : (
              <>
                <Create
                  provider={provider}
                  dao={dao}
                  setIsLoading={setIsLoading}
                />

                <hr/>

                <p className='text-center'><strong>Treasury Balance:</strong> {treasuryBalance} ETH</p>

                <hr/>

                <Proposals
                  provider={provider}
                  dao={dao}
                  proposals={proposals}
                  quorum={quorum}
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
