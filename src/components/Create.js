import { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { ethers } from "ethers";

const Create = ({ provider, dao, setIsLoading }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const createHandler = async (e) => {
    e.preventDefault();

    if (!provider || !dao) {
      window.alert("Wallet or DAO contract is not connected yet.");
      return;
    }

    if (!name.trim()) {
      window.alert("Please enter a proposal name.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      window.alert("Please enter a valid ETH amount.");
      return;
    }

    if (!ethers.isAddress(address)) {
      window.alert("Please enter a valid recipient address.");
      return;
    }

    setIsWaiting(true);

    try {
      const signer = await provider.getSigner();
      const formattedAmount = ethers.parseEther(amount.toString());

      const tx = await dao
        .connect(signer)
        .createProposal(name, formattedAmount, address);

      await tx.wait();

      setName("");
      setAmount("");
      setAddress("");
      setIsLoading(true);
    } catch (err) {
      console.error("Create proposal error:", err);

      window.alert(
        err?.error?.message ||
          err?.reason ||
          err?.shortMessage ||
          err?.message ||
          "User rejected or transaction reverted."
      );
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <Form onSubmit={createHandler}>
      <Form.Group style={{ maxWidth: "450px", margin: "50px auto" }}>
        <Form.Control
          type="text"
          placeholder="Enter proposal name"
          className="my-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Form.Control
          type="number"
          step="any"
          min="0"
          placeholder="Enter amount in ETH"
          className="my-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Form.Control
          type="text"
          placeholder="Enter recipient address"
          className="my-2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        {isWaiting ? (
          <Spinner
            animation="border"
            style={{ display: "block", margin: "0 auto" }}
          />
        ) : (
          <Button
            variant="primary"
            type="submit"
            style={{ width: "100%" }}
            disabled={!provider || !dao}
          >
            Create Proposal
          </Button>
        )}
      </Form.Group>
    </Form>
  );
};

export default Create;
