export default {
  "abi": [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_supplyChainContract",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "manufacturer",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "productModel",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "serialNumber",
          "type": "string"
        }
      ],
      "name": "ProductIdRegistered",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_tokenId",
          "type": "uint256"
        }
      ],
      "name": "getBlockchainId",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_tokenId",
          "type": "uint256"
        }
      ],
      "name": "getProductIdDetails",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "chainId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "contractAddress",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "tokenId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "manufacturer",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "productModel",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "serialNumber",
              "type": "string"
            }
          ],
          "internalType": "struct ProductIdentifier.BlockchainProductId",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "name": "lookupByManufacturer",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_manufacturer",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "_productModel",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_serialNumber",
          "type": "string"
        }
      ],
      "name": "lookupTokenId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "productIds",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "chainId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "contractAddress",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "manufacturer",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "productModel",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "serialNumber",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_tokenId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "_manufacturer",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "_productModel",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_serialNumber",
          "type": "string"
        }
      ],
      "name": "registerProductId",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "supplyChainContract",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};
