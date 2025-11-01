const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain - Integration Tests", function () {
  let participantRegistry, productNFT, supplyChain;
  let owner, producer, distributor, retailer, buyer1, buyer2;

  beforeEach(async function () {
    [owner, producer, distributor, retailer, buyer1, buyer2] = await ethers.getSigners();

    // Deploy ParticipantRegistry
    const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
    participantRegistry = await ParticipantRegistry.deploy();
    await participantRegistry.waitForDeployment();

    // Deploy ProductNFT
    const ProductNFT = await ethers.getContractFactory("ProductNFT");
    productNFT = await ProductNFT.deploy();
    await productNFT.waitForDeployment();

    // Deploy SupplyChain
    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy(
      await participantRegistry.getAddress(),
      await productNFT.getAddress()
    );
    await supplyChain.waitForDeployment();

    // Set SupplyChain as authorized contract in ProductNFT
    await productNFT.setSupplyChainContract(await supplyChain.getAddress());

    // Register and verify participants
    await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmProducerDoc");
    await participantRegistry.connect(distributor).registerParticipant(2, "ipfs://QmDistributorDoc");
    await participantRegistry.connect(retailer).registerParticipant(3, "ipfs://QmRetailerDoc");
    await participantRegistry.connect(buyer1).registerParticipant(4, "ipfs://QmBuyer1Doc");
    await participantRegistry.connect(buyer2).registerParticipant(4, "ipfs://QmBuyer2Doc");

    await participantRegistry.verifyParticipant(producer.address);
    await participantRegistry.verifyParticipant(distributor.address);
    await participantRegistry.verifyParticipant(retailer.address);
    await participantRegistry.verifyParticipant(buyer1.address);
    await participantRegistry.verifyParticipant(buyer2.address);
  });

  describe("Product Creation", function () {
    it("Should allow producer to create product", async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );

      const product = await supplyChain.getProduct(1);
      expect(product.tokenId).to.equal(1);
      expect(product.producer).to.equal(producer.address);
      expect(product.currentOwner).to.equal(producer.address);
      expect(product.status).to.equal(0); // MANUFACTURED
    });

    it("Should emit ProductManufactured event", async function () {
      await expect(
        supplyChain.connect(producer).createProduct(
          "ipfs://QmProduct1",
          "physical",
          31536000
        )
      )
        .to.emit(supplyChain, "ProductManufactured")
        .withArgs(1, producer.address, "ipfs://QmProduct1");
    });

    it("Should not allow non-producer to create product", async function () {
      await expect(
        supplyChain.connect(distributor).createProduct(
          "ipfs://QmProduct1",
          "physical",
          31536000
        )
      ).to.be.revertedWith("Unauthorized: Invalid role or not verified");
    });

    it("Should mint NFT to producer", async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );

      expect(await productNFT.ownerOf(1)).to.equal(producer.address);
    });
  });

  describe("Full Supply Chain Flow", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should complete full supply chain: Producer -> Distributor -> Retailer -> Buyer", async function () {
      // Producer to Distributor
      await supplyChain.connect(producer).transferToDistributor(1, distributor.address);
      expect(await productNFT.ownerOf(1)).to.equal(distributor.address);
      let product = await supplyChain.getProduct(1);
      expect(product.status).to.equal(1); // WITH_DISTRIBUTOR

      // Distributor to Retailer
      await supplyChain.connect(distributor).transferToRetailer(1, retailer.address);
      expect(await productNFT.ownerOf(1)).to.equal(retailer.address);
      product = await supplyChain.getProduct(1);
      expect(product.status).to.equal(2); // WITH_RETAILER

      // Retailer to Buyer
      await supplyChain.connect(retailer).sellToBuyer(1, buyer1.address, "ipfs://QmSaleReceipt");
      expect(await productNFT.ownerOf(1)).to.equal(buyer1.address);
      product = await supplyChain.getProduct(1);
      expect(product.status).to.equal(3); // SOLD_TO_BUYER
      expect(product.buyer).to.equal(buyer1.address);
    });

    it("Should record all transfers in history", async function () {
      await supplyChain.connect(producer).transferToDistributor(1, distributor.address);
      await supplyChain.connect(distributor).transferToRetailer(1, retailer.address);
      await supplyChain.connect(retailer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");

      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(4); // manufacture + 3 transfers
      expect(history[0].transferType).to.equal("manufacture");
      expect(history[1].transferType).to.equal("supply_chain");
      expect(history[2].transferType).to.equal("supply_chain");
      expect(history[3].transferType).to.equal("sale");
    });

    it("Should emit correct events", async function () {
      await expect(supplyChain.connect(producer).transferToDistributor(1, distributor.address))
        .to.emit(supplyChain, "ProductTransferredToDistributor")
        .withArgs(1, distributor.address);

      await expect(supplyChain.connect(distributor).transferToRetailer(1, retailer.address))
        .to.emit(supplyChain, "ProductTransferredToRetailer")
        .withArgs(1, retailer.address);

      await expect(supplyChain.connect(retailer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt"))
        .to.emit(supplyChain, "ProductSoldToBuyer")
        .withArgs(1, buyer1.address, "ipfs://QmReceipt");
    });
  });

  describe("Direct Sale Flow (Producer to Buyer)", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "digital",
        15768000
      );
    });

    it("Should allow direct sale from producer to buyer", async function () {
      await supplyChain.connect(producer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");

      expect(await productNFT.ownerOf(1)).to.equal(buyer1.address);
      const product = await supplyChain.getProduct(1);
      expect(product.status).to.equal(3); // SOLD_TO_BUYER
      expect(product.buyer).to.equal(buyer1.address);
    });

    it("Should record sale details", async function () {
      await supplyChain.connect(producer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");

      const product = await supplyChain.getProduct(1);
      expect(product.saleDetails).to.equal("ipfs://QmReceipt");
      expect(product.saleDate).to.be.gt(0);
    });
  });

  describe("Secondary Market Flow (Buyer to Buyer)", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
      await supplyChain.connect(producer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt1");
    });

    it("Should allow buyer to resell product", async function () {
      await supplyChain.connect(buyer1).resellProduct(1, buyer2.address);

      expect(await productNFT.ownerOf(1)).to.equal(buyer2.address);
      const product = await supplyChain.getProduct(1);
      expect(product.status).to.equal(4); // RESOLD
      expect(product.currentOwner).to.equal(buyer2.address);
    });

    it("Should emit ProductResold event", async function () {
      await expect(supplyChain.connect(buyer1).resellProduct(1, buyer2.address))
        .to.emit(supplyChain, "ProductResold")
        .withArgs(1, buyer1.address, buyer2.address);
    });

    it("Should record resale in transfer history", async function () {
      await supplyChain.connect(buyer1).resellProduct(1, buyer2.address);

      const history = await productNFT.getTransferHistory(1);
      const lastTransfer = history[history.length - 1];
      expect(lastTransfer.transferType).to.equal("secondary_sale");
      expect(lastTransfer.from).to.equal(buyer1.address);
      expect(lastTransfer.to).to.equal(buyer2.address);
    });

    it("Should allow multiple resales", async function () {
      await supplyChain.connect(buyer1).resellProduct(1, buyer2.address);
      await supplyChain.connect(buyer2).resellProduct(1, buyer1.address);

      expect(await productNFT.ownerOf(1)).to.equal(buyer1.address);
      const history = await productNFT.getTransferHistory(1);
      expect(history.length).to.equal(4); // manufacture + sale + 2 resales
    });
  });

  describe("Access Control", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should not allow non-owner to transfer product", async function () {
      await expect(
        supplyChain.connect(distributor).transferToDistributor(1, distributor.address)
      ).to.be.revertedWith("Not current owner");
    });

    it("Should not allow transfer to unverified distributor", async function () {
      const [, , , , , , unverified] = await ethers.getSigners();
      
      await expect(
        supplyChain.connect(producer).transferToDistributor(1, unverified.address)
      ).to.be.revertedWith("Recipient is not a verified distributor");
    });

    it("Should not allow transfer to unverified retailer", async function () {
      const [, , , , , , unverified] = await ethers.getSigners();
      
      await expect(
        supplyChain.connect(producer).transferToRetailer(1, unverified.address)
      ).to.be.revertedWith("Recipient is not a verified retailer");
    });

    it("Should not allow sale to unverified buyer", async function () {
      const [, , , , , , unverified] = await ethers.getSigners();
      
      await expect(
        supplyChain.connect(producer).sellToBuyer(1, unverified.address, "ipfs://QmReceipt")
      ).to.be.revertedWith("Buyer must be a verified participant");
    });
  });

  describe("Product Verification", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should verify product authenticity", async function () {
      const isAuthentic = await supplyChain.verifyAuthenticity(1);
      expect(isAuthentic).to.equal(true);
    });

    it("Should return false for non-existent product", async function () {
      const isAuthentic = await supplyChain.verifyAuthenticity(999);
      expect(isAuthentic).to.equal(false);
    });

    it("Should check warranty validity", async function () {
      const isValid = await supplyChain.checkWarranty(1);
      expect(isValid).to.equal(true);
    });
  });

  describe("Status Checks", function () {
    beforeEach(async function () {
      await supplyChain.connect(producer).createProduct(
        "ipfs://QmProduct1",
        "physical",
        31536000
      );
    });

    it("Should return correct product status", async function () {
      expect(await supplyChain.getProductStatus(1)).to.equal(0); // MANUFACTURED

      await supplyChain.connect(producer).transferToDistributor(1, distributor.address);
      expect(await supplyChain.getProductStatus(1)).to.equal(1); // WITH_DISTRIBUTOR

      await supplyChain.connect(distributor).transferToRetailer(1, retailer.address);
      expect(await supplyChain.getProductStatus(1)).to.equal(2); // WITH_RETAILER

      await supplyChain.connect(retailer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");
      expect(await supplyChain.getProductStatus(1)).to.equal(3); // SOLD_TO_BUYER
    });

    it("Should return current owner", async function () {
      expect(await supplyChain.getCurrentOwner(1)).to.equal(producer.address);

      await supplyChain.connect(producer).transferToDistributor(1, distributor.address);
      expect(await supplyChain.getCurrentOwner(1)).to.equal(distributor.address);
    });
  });

  describe("Edge Cases", function () {
    it("Should not allow operations on non-existent product", async function () {
      await expect(
        supplyChain.getProduct(999)
      ).to.be.revertedWith("Product does not exist");
    });

    it("Should not allow selling already sold product", async function () {
      await supplyChain.connect(producer).createProduct("ipfs://QmProduct1", "physical", 31536000);
      await supplyChain.connect(producer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");

      await expect(
        supplyChain.connect(buyer1).sellToBuyer(1, buyer2.address, "ipfs://QmReceipt2")
      ).to.be.revertedWith("Product already sold");
    });

    it("Should use resellProduct for secondary market transfers", async function () {
      await supplyChain.connect(producer).createProduct("ipfs://QmProduct1", "physical", 31536000);
      await supplyChain.connect(producer).sellToBuyer(1, buyer1.address, "ipfs://QmReceipt");

      // Should use resellProduct, not sellToBuyer
      await supplyChain.connect(buyer1).resellProduct(1, buyer2.address);
      expect(await productNFT.ownerOf(1)).to.equal(buyer2.address);
    });
  });
});

