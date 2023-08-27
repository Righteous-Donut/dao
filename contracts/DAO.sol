//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract DAO {
    address owner;
    Token public token;
    uint256 public quorum;

    struct Proposal {
        uint256 id;
        string name;
        uint256 amount;
        address payable recipient;
        uint256 forVotes;      // Votes in favor
        uint256 againstVotes;  // Votes against
        bool finalized;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) votes;

    event Propose(
        uint id,
        uint256 amount,
        address recipient,
        address creator
    );
    event Vote(uint256 id, address investor, bool inFavor);  // Added inFavor to the event
    event Finalize(uint256 id);

    constructor(Token _token, uint256 _quorum) {
        owner = msg.sender;
        token = _token;
        quorum = _quorum;
    }

    // Allow contract to receive ether
    receive() external payable {}

    modifier onlyInvestor() {
        require(token.balanceOf(msg.sender) > 0, "must be token holder");
        _;
    }

    function createProposal(
        string memory _name,
        uint256 _amount,
        address payable _recipient
    ) external onlyInvestor {
        require(address(this).balance >= _amount);

        proposalCount++;

        proposals[proposalCount] = Proposal(
            proposalCount,
            _name,
            _amount,
            _recipient,
            0,   // forVotes initialized to 0
            0,   // againstVotes initialized to 0
            false
        );

        emit Propose(
            proposalCount,
            _amount,
            _recipient,
            msg.sender
        );
    }

    function vote(uint256 _id, bool inFavor) external onlyInvestor {
        Proposal storage proposal = proposals[_id];
        require(!votes[msg.sender][_id], "already voted");

        uint256 voterBalance = token.balanceOf(msg.sender);

        if (inFavor) {
            proposal.forVotes += voterBalance;
        } else {
            proposal.againstVotes += voterBalance;
        }

        votes[msg.sender][_id] = true;
        emit Vote(_id, msg.sender, inFavor);  // Emit the direction of the vote
    }

    function finalizeProposal(uint256 _id) external onlyInvestor {
        Proposal storage proposal = proposals[_id];
        require(!proposal.finalized, "proposal already finalized");

        proposal.finalized = true;

        // Modify the quorum check to account only for positive votes.
        require(proposal.forVotes >= quorum, "must reach quorum to finalize proposal");

        require(address(this).balance >= proposal.amount);
        (bool sent, ) = proposal.recipient.call{value: proposal.amount}("");

        emit Finalize(_id);
    }
}
