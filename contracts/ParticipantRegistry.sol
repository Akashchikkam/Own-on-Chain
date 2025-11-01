// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ParticipantRegistry
 * @dev Manages registration and verification of supply chain participants
 */
contract ParticipantRegistry is Ownable {
    
    enum Role {
        NONE,
        PRODUCER,
        DISTRIBUTOR,
        RETAILER,
        BUYER
    }

    enum VerificationStatus {
        PENDING,
        VERIFIED,
        REJECTED
    }

    struct Participant {
        address participantAddress;
        Role role;
        VerificationStatus status;
        string verificationDocument; // IPFS hash of GST/Aadhar/verification docs
        uint256 registrationDate;
        bool isActive;
    }

    // Mapping from address to Participant
    mapping(address => Participant) public participants;
    
    // Array to track all participant addresses
    address[] public participantAddresses;

    // Events
    event ParticipantRegistered(address indexed participant, Role role, string verificationDocument);
    event ParticipantVerified(address indexed participant, Role role);
    event ParticipantRejected(address indexed participant, string reason);
    event ParticipantDeactivated(address indexed participant);
    event ParticipantReactivated(address indexed participant);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a new participant with their role and verification documents
     * @param _role The role the participant wants to register as
     * @param _verificationDocument IPFS hash of verification documents
     */
    function registerParticipant(Role _role, string memory _verificationDocument) external {
        require(_role != Role.NONE, "Invalid role");
        require(bytes(_verificationDocument).length > 0, "Verification document required");

        // Allow re-registration if previously rejected
        // But prevent re-registration if already registered (pending or verified)
        Participant memory existing = participants[msg.sender];
        if (existing.participantAddress != address(0)) {
            require(
                existing.status == VerificationStatus.REJECTED,
                "Already registered. Cannot register again unless previously rejected."
            );
            // If rejected, allow re-registration - update existing record
        }

        Participant memory newParticipant = Participant({
            participantAddress: msg.sender,
            role: _role,
            status: VerificationStatus.PENDING,
            verificationDocument: _verificationDocument,
            registrationDate: block.timestamp,
            isActive: false // Will be activated upon verification
        });

        participants[msg.sender] = newParticipant;
        
        // Only add to array if this is first registration (not a re-registration after rejection)
        if (existing.participantAddress == address(0)) {
            participantAddresses.push(msg.sender);
        }

        emit ParticipantRegistered(msg.sender, _role, _verificationDocument);
    }

    /**
     * @dev Verify a participant (only admin/owner can call)
     * @param _participant Address of the participant to verify
     */
    function verifyParticipant(address _participant) external onlyOwner {
        require(participants[_participant].participantAddress != address(0), "Participant not found");
        require(participants[_participant].status == VerificationStatus.PENDING, "Already processed");

        participants[_participant].status = VerificationStatus.VERIFIED;
        participants[_participant].isActive = true;

        emit ParticipantVerified(_participant, participants[_participant].role);
    }

    /**
     * @dev Reject a participant's registration (only admin/owner can call)
     * @param _participant Address of the participant to reject
     * @param _reason Reason for rejection
     */
    function rejectParticipant(address _participant, string memory _reason) external onlyOwner {
        require(participants[_participant].participantAddress != address(0), "Participant not found");
        require(participants[_participant].status == VerificationStatus.PENDING, "Already processed");

        participants[_participant].status = VerificationStatus.REJECTED;

        emit ParticipantRejected(_participant, _reason);
    }

    /**
     * @dev Deactivate a participant (only admin/owner can call)
     * @param _participant Address of the participant to deactivate
     */
    function deactivateParticipant(address _participant) external onlyOwner {
        require(participants[_participant].participantAddress != address(0), "Participant not found");
        require(participants[_participant].isActive, "Already inactive");

        participants[_participant].isActive = false;

        emit ParticipantDeactivated(_participant);
    }

    /**
     * @dev Reactivate a participant (only admin/owner can call)
     * @param _participant Address of the participant to reactivate
     */
    function reactivateParticipant(address _participant) external onlyOwner {
        require(participants[_participant].participantAddress != address(0), "Participant not found");
        require(participants[_participant].status == VerificationStatus.VERIFIED, "Must be verified");
        require(!participants[_participant].isActive, "Already active");

        participants[_participant].isActive = true;

        emit ParticipantReactivated(_participant);
    }

    /**
     * @dev Check if an address is a verified participant with a specific role
     * @param _participant Address to check
     * @param _role Role to verify
     * @return bool True if participant has the role and is active
     */
    function hasRole(address _participant, Role _role) external view returns (bool) {
        Participant memory p = participants[_participant];
        return p.participantAddress != address(0) && 
               p.role == _role && 
               p.status == VerificationStatus.VERIFIED && 
               p.isActive;
    }

    /**
     * @dev Check if an address is verified and active (any role)
     * @param _participant Address to check
     * @return bool True if participant is verified and active
     */
    function isVerifiedParticipant(address _participant) external view returns (bool) {
        Participant memory p = participants[_participant];
        return p.participantAddress != address(0) && 
               p.status == VerificationStatus.VERIFIED && 
               p.isActive;
    }

    /**
     * @dev Get participant details
     * @param _participant Address of the participant
     * @return Participant struct
     */
    function getParticipant(address _participant) external view returns (Participant memory) {
        require(participants[_participant].participantAddress != address(0), "Participant not found");
        return participants[_participant];
    }

    /**
     * @dev Get all pending participants for admin review
     * @return Array of pending participant addresses
     */
    function getPendingParticipants() external view returns (address[] memory) {
        uint256 pendingCount = 0;
        
        // Count pending participants
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            if (participants[participantAddresses[i]].status == VerificationStatus.PENDING) {
                pendingCount++;
            }
        }

        // Create array of pending addresses
        address[] memory pending = new address[](pendingCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            if (participants[participantAddresses[i]].status == VerificationStatus.PENDING) {
                pending[currentIndex] = participantAddresses[i];
                currentIndex++;
            }
        }

        return pending;
    }

    /**
     * @dev Get total number of participants
     * @return Total count of registered participants
     */
    function getTotalParticipants() external view returns (uint256) {
        return participantAddresses.length;
    }

    /**
     * @dev Get participant role
     * @param _participant Address of the participant
     * @return Role of the participant
     */
    function getParticipantRole(address _participant) external view returns (Role) {
        return participants[_participant].role;
    }
}

