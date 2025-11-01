const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductNFT", function () {
  let productNFT, supplyChainContract;
  let owner, producer, buyer;

  beforeEach(async function () {
    [owner, producer, buyer, supplyChainContract] = await ethers.getSigners();

    const ProductNFT = await ethers.getContractFactory("ProductNFT");
    productNFT = await ProductNFT.deploy();
    await productNFT.waitForDeployment();

    // Set supply chain contract
    await productNFT.setSupplyChainContract(supplyChainContract.address);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await productNFT.owner()).to.equal(owner.address);
    });

    it("Should set the supply chain contract", async function () {
      expect(await productNFT.supplyChainContract()).to.equal(supplyChainContract.address);
    });

    it("Should start token IDs from 1", async function () {
      expect(await productNFT.getNextTokenId()).to.equal(1);
    });
  });

  describe("Minting", function () {
    it("Should allow supply chain contract to mint product", async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000 // 1 year warranty in seconds
      );

      expect(await productNFT.ownerOf(1)).to.equal(producer.address);
      expect(await productNFT.tokenURI(1)).to.equal("ipfs://QmProduct1");
    });

    it("Should emit ProductCreated event", async function () {
      await expect(
        productNFT.connect(supplyChainContract).mintProduct(
          producer.address,
          "ipfs://QmProduct1",
          "physical",
          31536000
        )
      )
        .to.emit(productNFT, "ProductCreated")
        .withArgs(1, producer.address, "ipfs://QmProduct1");
    });

    it("Should not allow non-supply chain contract to mint", async function () {
      await expect(
        productNFT.connect(producer).mintProduct(
          producer.address,
          "ipfs://QmProduct1",
          "physical",
          31536000
        )
      ).to.be.revertedWith("Only SupplyChain contract can call this");
    });

    it("Should store product info correctly", async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000
      );

      const info = await productNFT.getProductInfo(1);
      expect(info.tokenId).to.equal(1);
      expect(info.producer).to.equal(producer.address);
      expect(info.productType).to.equal("physical");
      expect(info.warrantyPeriod).to.equal(31536000);
      expect(info.isActive).to.equal(true);
    });

    it("Should increment token ID", async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000
      );

      expect(await productNFT.getNextTokenId()).to.equal(2);
    });
  });

  describe("Transfer History", function () {
    beforeEach(async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should record initial creation in transfer history", async function () {
      const history = await productNFT.getTransferHistory(1);
      
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(ethers.ZeroAddress);
      expect(history[0].to).to.equal(producer.address);
      expect(history[0].transferType).to.equal("manufacture");
    });

    it("Should allow supply chain contract to record transfers", async function () {
      await productNFT.connect(supplyChainContract).recordTransfer(
        1,
        producer.address,
        buyer.address,
        "sale"
      );

      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(2);
      expect(history[1].from).to.equal(producer.address);
      expect(history[1].to).to.equal(buyer.address);
      expect(history[1].transferType).to.equal("sale");
    });

    it("Should emit ProductTransferred event", async function () {
      await expect(
        productNFT.connect(supplyChainContract).recordTransfer(
          1,
          producer.address,
          buyer.address,
          "sale"
        )
      )
        .to.emit(productNFT, "ProductTransferred")
        .withArgs(1, producer.address, buyer.address, "sale");
    });
  });

  describe("Token Transfer", function () {
    beforeEach(async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should allow supply chain contract to execute transfer", async function () {
      await productNFT.connect(supplyChainContract).executeTransfer(
        producer.address,
        buyer.address,
        1
      );

      expect(await productNFT.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should not allow non-supply chain contract to execute transfer", async function () {
      await expect(
        productNFT.connect(producer).executeTransfer(producer.address, buyer.address, 1)
      ).to.be.revertedWith("Only SupplyChain contract can call this");
    });

    it("Should not allow transfer from non-owner", async function () {
      await expect(
        productNFT.connect(supplyChainContract).executeTransfer(buyer.address, producer.address, 1)
      ).to.be.revertedWith("From address must be current owner");
    });
  });

  describe("Warranty", function () {
    it("Should return true for valid warranty", async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000 // 1 year
      );

      expect(await productNFT.isWarrantyValid(1)).to.equal(true);
    });

    it("Should return false for expired warranty", async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        1 // 1 second
      );

      // Wait for warranty to expire
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine");

      expect(await productNFT.isWarrantyValid(1)).to.equal(false);
    });
  });

  describe("Token Queries", function () {
    beforeEach(async function () {
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
      await productNFT.connect(supplyChainContract).mintProduct(
        producer.address,
        "ipfs://QmProduct2",
        "digital",
        15768000
      );
      await productNFT.connect(supplyChainContract).executeTransfer(
        producer.address,
        buyer.address,
        2
      );
    });

    it("Should return tokens owned by address", async function () {
      const producerTokens = await productNFT.getTokensByOwner(producer.address);
      const buyerTokens = await productNFT.getTokensByOwner(buyer.address);

      expect(producerTokens.length).to.equal(1);
      expect(producerTokens[0]).to.equal(1);
      expect(buyerTokens.length).to.equal(1);
      expect(buyerTokens[0]).to.equal(2);
    });

    it("Should return empty array for address with no tokens", async function () {
      const [, , , other] = await ethers.getSigners();
      const tokens = await productNFT.getTokensByOwner(other.address);
      expect(tokens.length).to.equal(0);
    });
  });
});

