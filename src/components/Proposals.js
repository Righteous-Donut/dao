import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import { ethers } from "ethers";

function parseEthersError(err) {
  return (
    err?.error?.data?.message ||
    err?.error?.message ||
    err?.reason ||
    err?.shortMessage ||
    err?.data?.message ||
    err?.message ||
    null
  );
}

function getProposalId(proposal, index) {
  return proposal.id ?? index + 1;
}

function getProposalVotes(proposal) {
  return proposal.forVotes ?? proposal.votes ?? 0n;
}

const Proposals = ({
  provider,
  dao,
  proposals,
  quorum,
  canVote = true,
  setIsLoading,
}) => {
  const voteHandler = async (id) => {
    try {
      if (!provider || !dao) {
        window.alert("Wallet or DAO contract is not connected yet.");
        return;
      }

      if (!canVote) {
        window.alert("You need governance tokens to vote.");
        return;
      }

      const signer = await provider.getSigner();
      const daoWithSigner = dao.connect(signer);

      await daoWithSigner.vote.staticCall(id, true);

      const tx = await daoWithSigner.vote(id, true);
      await tx.wait();
    } catch (err) {
      console.error("Vote error:", err);

      const msg = parseEthersError(err);

      const friendly =
        /finaliz/i.test(msg || "")
          ? "This proposal is already finalized."
          : /already voted|has voted/i.test(msg || "")
          ? "You already voted on this proposal."
          : /onlyInvestor|not an investor|balance/i.test(msg || "")
          ? "You need governance tokens to vote."
          : msg || "User rejected or transaction reverted.";

      window.alert(friendly);
    } finally {
      setIsLoading(true);
    }
  };

  const finalizeHandler = async (id) => {
    try {
      if (!provider || !dao) {
        window.alert("Wallet or DAO contract is not connected yet.");
        return;
      }

      const signer = await provider.getSigner();
      const daoWithSigner = dao.connect(signer);

      await daoWithSigner.finalizeProposal.staticCall(id);

      const tx = await daoWithSigner.finalizeProposal(id);
      await tx.wait();
    } catch (err) {
      console.error("Finalize error:", err);

      const msg = parseEthersError(err);
      window.alert(msg || "User rejected or transaction reverted.");
    } finally {
      setIsLoading(true);
    }
  };

  return (
    <Table striped bordered hover responsive>
      <thead>
        <tr>
          <th>#</th>
          <th>Proposal Name</th>
          <th>Recipient</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Votes / Quorum</th>
          <th>Cast Vote</th>
          <th>Finalize</th>
        </tr>
      </thead>

      <tbody>
        {proposals.map((proposal, index) => {
          const id = getProposalId(proposal, index);
          const votes = getProposalVotes(proposal);
          const quorumValue = quorum ?? 0n;
          const canFinalize = votes >= quorumValue;

          return (
            <tr key={id.toString()}>
              <td>{id.toString()}</td>
              <td>{proposal.name}</td>
              <td>{proposal.recipient}</td>
              <td>{ethers.formatEther(proposal.amount)} ETH</td>
              <td>{proposal.finalized ? "Approved" : "In Progress"}</td>
              <td>
                {ethers.formatUnits(votes, 18)} /{" "}
                {ethers.formatUnits(quorumValue, 18)}
              </td>
              <td>
                {!proposal.finalized && (
                  <Button
                    variant="primary"
                    style={{ width: "100%" }}
                    onClick={() => voteHandler(id)}
                    disabled={!canVote || !provider || !dao}
                    title={!canVote ? "You need governance tokens to vote" : ""}
                  >
                    Vote
                  </Button>
                )}
              </td>
              <td>
                {!proposal.finalized && canFinalize && (
                  <Button
                    variant="primary"
                    style={{ width: "100%" }}
                    onClick={() => finalizeHandler(id)}
                    disabled={!provider || !dao}
                  >
                    Finalize
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

export default Proposals;
