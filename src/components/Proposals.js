import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { ethers } from 'ethers'

function parseEthersError(err) {
  return (
    err?.error?.data?.message ||
    err?.error?.message ||
    err?.reason ||
    err?.data?.message ||
    err?.message ||
    null
  );
}

const Proposals = ({ provider, dao, proposals, quorum, canVote = true, setIsLoading }) => {
  const voteHandler = async (id) => {
    try {
      if (!canVote) {
        window.alert('You need governance tokens to vote.');
        return;
      }
      const signer = await provider.getSigner();

      // 🔎 Simulate first to catch "already voted" or "finalized" before sending a tx
      await dao.connect(signer).callStatic.vote(id, true);

      const tx = await dao.connect(signer).vote(id, true);
      await tx.wait();
    } catch (err) {
      console.error('Vote error:', err);
      const msg = parseEthersError(err);
      const friendly =
        /finaliz/i.test(msg || '') ? 'This proposal is already finalized.' :
        /already voted|has voted/i.test(msg || '') ? 'You already voted on this proposal.' :
        /onlyInvestor|not an investor|balance/i.test(msg || '') ? 'You need governance tokens to vote.' :
        msg || 'User rejected or transaction reverted';
      window.alert(friendly);
    } finally {
      setIsLoading(true); // refresh state from chain
    }
  };

  const finalizeHandler = async (id) => {
    try {
      const signer = await provider.getSigner();
      // Pre-flight simulate finalize too
      await dao.connect(signer).callStatic.finalizeProposal(id);
      const tx = await dao.connect(signer).finalizeProposal(id);
      await tx.wait();
    } catch (err) {
      console.error('Finalize error:', err);
      const msg = parseEthersError(err) || 'User rejected or transaction reverted';
      window.alert(msg);
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
          const votesBN = ethers.BigNumber.from((proposal.forVotes ?? proposal.votes));
          const canFinalize = votesBN.gte(ethers.BigNumber.from(quorum));
          return (
            <tr key={index}>
              <td>{proposal.id.toString()}</td>
              <td>{proposal.name}</td>
              <td>{proposal.recipient}</td>
              <td>{ethers.utils.formatUnits(proposal.amount, "ether")} ETH</td>
              <td>{proposal.finalized ? 'Approved' : 'In Progress'}</td>
              <td>
                {ethers.utils.formatUnits(votesBN, 18)} / {ethers.utils.formatUnits(quorum, 18)}
              </td>
              <td>
                {!proposal.finalized && (
                  <Button
                    variant="primary"
                    style={{ width: '100%' }}
                    onClick={() => voteHandler(proposal.id)}
                    disabled={!canVote}
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
                    style={{ width: '100%' }}
                    onClick={() => finalizeHandler(proposal.id)}
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
