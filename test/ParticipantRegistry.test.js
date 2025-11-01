const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ParticipantRegistry", function () {
  let participantRegistry;
  let owner, producer, distributor, retailer, buyer;

  beforeEach(async function () {
    [owner, producer, distributor, retailer, buyer] = await ethers.getSigners();

    const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
    participantRegistry = await ParticipantRegistry.deploy();
    await participantRegistry.waitForDeployment();
  });

  describe("Registration", function () {
    it("Should allow user to register as producer", async function () {
      await participantRegistry.connect(producer).registerParticipant(
        1, // Role.PRODUCER
        "ipfs://QmProducerDoc"
      );

      const participant = await participantRegistry.getParticipant(producer.address);
      expect(participant.participantAddress).to.equal(producer.address);
      expect(participant.role).to.equal(1);
      expect(participant.status).to.equal(0); // PENDING
    });

    it("Should emit ParticipantRegistered event", async function () {
      await expect(
        participantRegistry.connect(distributor).registerParticipant(
          2, // Role.DISTRIBUTOR
          "ipfs://QmDistributorDoc"
        )
      )
        .to.emit(participantRegistry, "ParticipantRegistered")
        .withArgs(distributor.address, 2, "ipfs://QmDistributorDoc");
    });

    it("Should not allow registration without verification document", async function () {
      await expect(
        participantRegistry.connect(producer).registerParticipant(1, "")
      ).to.be.revertedWith("Verification document required");
    });

    it("Should not allow duplicate registration", async function () {
      await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmDoc");
      
      await expect(
        participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmDoc2")
      ).to.be.revertedWith("Already registered");
    });

    it("Should not allow registration with NONE role", async function () {
      await expect(
        participantRegistry.connect(producer).registerParticipant(0, "ipfs://QmDoc")
      ).to.be.revertedWith("Invalid role");
    });
  });

  describe("Verification", function () {
    beforeEach(async function () {
      await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmProducerDoc");
      await participantRegistry.connect(distributor).registerParticipant(2, "ipfs://QmDistributorDoc");
    });

    it("Should allow owner to verify participant", async function () {
      await participantRegistry.verifyParticipant(producer.address);

      const participant = await participantRegistry.getParticipant(producer.address);
      expect(participant.status).to.equal(1); // VERIFIED
      expect(participant.isActive).to.equal(true);
    });

    it("Should emit ParticipantVerified event", async function () {
      await expect(participantRegistry.verifyParticipant(producer.address))
        .to.emit(participantRegistry, "ParticipantVerified")
        .withArgs(producer.address, 1);
    });

    it("Should not allow non-owner to verify", async function () {
      await expect(
        participantRegistry.connect(producer).verifyParticipant(distributor.address)
      ).to.be.reverted;
    });

    it("Should allow owner to reject participant", async function () {
      await participantRegistry.rejectParticipant(producer.address, "Invalid documents");

      const participant = await participantRegistry.getParticipant(producer.address);
      expect(participant.status).to.equal(2); // REJECTED
    });

    it("Should emit ParticipantRejected event", async function () {
      await expect(
        participantRegistry.rejectParticipant(producer.address, "Invalid documents")
      )
        .to.emit(participantRegistry, "ParticipantRejected")
        .withArgs(producer.address, "Invalid documents");
    });
  });

  describe("Role Checking", function () {
    beforeEach(async function () {
      await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmProducerDoc");
      await participantRegistry.connect(distributor).registerParticipant(2, "ipfs://QmDistributorDoc");
      await participantRegistry.verifyParticipant(producer.address);
    });

    it("Should return true for hasRole with correct role", async function () {
      expect(await participantRegistry.hasRole(producer.address, 1)).to.equal(true);
    });

    it("Should return false for hasRole with incorrect role", async function () {
      expect(await participantRegistry.hasRole(producer.address, 2)).to.equal(false);
    });

    it("Should return false for unverified participant", async function () {
      expect(await participantRegistry.hasRole(distributor.address, 2)).to.equal(false);
    });

    it("Should return true for isVerifiedParticipant", async function () {
      expect(await participantRegistry.isVerifiedParticipant(producer.address)).to.equal(true);
    });

    it("Should return false for unverified participant", async function () {
      expect(await participantRegistry.isVerifiedParticipant(distributor.address)).to.equal(false);
    });
  });

  describe("Deactivation", function () {
    beforeEach(async function () {
      await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmProducerDoc");
      await participantRegistry.verifyParticipant(producer.address);
    });

    it("Should allow owner to deactivate participant", async function () {
      await participantRegistry.deactivateParticipant(producer.address);

      const participant = await participantRegistry.getParticipant(producer.address);
      expect(participant.isActive).to.equal(false);
    });

    it("Should allow owner to reactivate participant", async function () {
      await participantRegistry.deactivateParticipant(producer.address);
      await participantRegistry.reactivateParticipant(producer.address);

      const participant = await participantRegistry.getParticipant(producer.address);
      expect(participant.isActive).to.equal(true);
    });

    it("Should not allow hasRole to return true for deactivated participant", async function () {
      await participantRegistry.deactivateParticipant(producer.address);
      expect(await participantRegistry.hasRole(producer.address, 1)).to.equal(false);
    });
  });

  describe("Pending Participants", function () {
    it("Should return list of pending participants", async function () {
      await participantRegistry.connect(producer).registerParticipant(1, "ipfs://QmDoc1");
      await participantRegistry.connect(distributor).registerParticipant(2, "ipfs://QmDoc2");
      await participantRegistry.connect(retailer).registerParticipant(3, "ipfs://QmDoc3");
      
      await participantRegistry.verifyParticipant(producer.address);

      const pending = await participantRegistry.getPendingParticipants();
      expect(pending.length).to.equal(2);
      expect(pending).to.include(distributor.address);
      expect(pending).to.include(retailer.address);
    });
  });
});

