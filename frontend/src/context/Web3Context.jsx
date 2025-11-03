import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [error, setError] = useState(null);

  // Network configuration - supports both local and testnet
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Determine which testnet to use (default: sepolia for easier faucet access)
  // Check VITE_NETWORK_NAME first - if set to sepolia, use Sepolia even on localhost
  const networkName = import.meta.env.VITE_NETWORK_NAME;
  const testnetChainId = import.meta.env.VITE_CHAIN_ID ? Number(import.meta.env.VITE_CHAIN_ID) : 11155111; // Sepolia default
  
  // Use testnet if explicitly configured via env var, otherwise use localhost only if truly local
  const useLocalhost = isLocalhost && (!networkName || networkName === 'localhost');
  const EXPECTED_CHAIN_ID = useLocalhost ? 1337 : testnetChainId;
  
  // Network configs
  const getNetworkConfig = () => {
    if (useLocalhost) {
      return {
        chainId: '0x539', // 1337 in hex
        chainName: 'Hardhat Local',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['http://127.0.0.1:8545'],
        blockExplorerUrls: [],
      };
    }
    
    // Sepolia (Ethereum testnet - easier faucets)
    if (testnetChainId === 11155111) {
      return {
        chainId: '0xaa36a7', // 11155111 in hex
        chainName: 'Sepolia Test Network',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://rpc.ankr.com/eth_sepolia'], // CORS-friendly
        blockExplorerUrls: ['https://sepolia.etherscan.io/'],
      };
    }
    
    // Polygon Amoy
    if (testnetChainId === 80002) {
      return {
        chainId: '0x1388a', // 80002 in hex
        chainName: 'Polygon Amoy Testnet',
        nativeCurrency: {
          name: 'POL',
          symbol: 'POL',
          decimals: 18,
        },
        rpcUrls: ['https://rpc-amoy.polygon.technology'],
        blockExplorerUrls: ['https://amoy.polygonscan.com/'],
      };
    }
    
    // Mumbai (deprecated but fallback)
    if (testnetChainId === 80001) {
      return {
        chainId: '0x13881', // 80001 in hex
        chainName: 'Polygon Mumbai',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
        blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
      };
    }
  };
  
  const NETWORK_CONFIG = getNetworkConfig();

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // Switch to correct network (memoized to avoid infinite loops)
  const switchNetwork = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK_CONFIG.chainId }],
      });
      return true;
    } catch (switchError) {
      // Network doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_CONFIG],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          setError(`Failed to add ${NETWORK_CONFIG.chainName} network`);
          return false;
        }
      }
      console.error('Error switching network:', switchError);
      setError(`Failed to switch to ${NETWORK_CONFIG.chainName} network`);
      return false;
    }
  }, [testnetChainId, isLocalhost, networkName]);

  // Connect wallet
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('Please install MetaMask to use this application');
      return false;
    }

    try {
      setError(null);
      
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      // Create provider and signer
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      // Check if on correct network
      if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
        setIsCorrectNetwork(false);
        const switched = await switchNetwork();
        if (switched) {
          // Reload provider after network switch
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          const newSigner = await newProvider.getSigner();
          const newNetwork = await newProvider.getNetwork();
          setProvider(newProvider);
          setSigner(newSigner);
          setChainId(Number(newNetwork.chainId));
          setIsCorrectNetwork(true);
        }
      } else {
        setIsCorrectNetwork(true);
      }

      return true;
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      return false;
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    setIsCorrectNetwork(false);
    setError(null);
  };

  // Listen for account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = async (accounts) => {
      console.log('🔄 Account changed:', accounts);
      
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        const newAccount = accounts[0];
        
        // Clear existing state immediately to prevent stale data
        setProvider(null);
        setSigner(null);
        setChainId(null);
        setIsConnected(false);
        setIsCorrectNetwork(false);
        setError(null);
        
        // Small delay to ensure state clears, then reconnect with new account
        setTimeout(async () => {
          try {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            const web3Signer = await web3Provider.getSigner();
            const network = await web3Provider.getNetwork();
            
            setAccount(newAccount);
            setProvider(web3Provider);
            setSigner(web3Signer);
            setChainId(Number(network.chainId));
            setIsConnected(true);
            setIsCorrectNetwork(Number(network.chainId) === EXPECTED_CHAIN_ID);
            
            // If wrong network, try to switch
            if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
              await switchNetwork();
            }
          } catch (err) {
            console.error('Error reconnecting after account change:', err);
            setError('Failed to reconnect after account change');
          }
        }, 100);
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      setIsCorrectNetwork(newChainId === EXPECTED_CHAIN_ID);
      // Reload the page to reset state
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [EXPECTED_CHAIN_ID]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (!isMetaMaskInstalled()) return;

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (err) {
        console.error('Error checking connection:', err);
      }
    };

    checkConnection();
  }, []);

  const value = {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isCorrectNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    expectedChainId: EXPECTED_CHAIN_ID,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

