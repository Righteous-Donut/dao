// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
if (bal.gte(target)) {
console.log(`⏭️ Skip: ${inv.address} already has >= ${INVESTOR_ALLOCATION} ${symbol}`);
continue;
}
console.log(`🔁 Transfer ${INVESTOR_ALLOCATION} ${symbol} -> ${inv.address}`);
const tx = await token.transfer(inv.address, target);
await tx.wait();
await maybeWaitFor(POST_TX_SLEEP_MS);
} catch (err) {
console.log(`⚠️ Token transfer to ${inv.address} failed: ${await getReasonOrMessage(err)}`);
}
}
console.log("✅ Token seeding complete.\n");


// ---------- Fund DAO treasury ----------
console.log(`➡️ Funding DAO treasury with ${DAO_TREASURY_ETH} ETH of dev funds...\n`);
try {
const tx = await funder.sendTransaction({ to: dao.address, value: tokens(DAO_TREASURY_ETH, 18) });
await tx.wait();
await maybeWaitFor(POST_TX_SLEEP_MS);
console.log("✅ DAO treasury funded.\n");
} catch (err) {
console.log(`⚠️ DAO funding failed: ${await getReasonOrMessage(err)}`);
}


// ---------- Create / vote / finalize proposals ----------
console.log(`➡️ Creating and finalizing ${PROPOSAL_COUNT} proposals...\n`);
for (let i = 0; i < PROPOSAL_COUNT; i++) {
const id = i + 1;
try {
const title = `Proposal ${id}`;
const val = tokens(PROPOSAL_VALUE_ETH, 18);


// Create
await (await dao.connect(investor1).createProposal(title, val, recipient.address)).wait();
await maybeWaitFor(POST_TX_SLEEP_MS);


// Vote yes from 3 investors
await (await dao.connect(investor1).vote(id, true)).wait();
await maybeWaitFor(POST_TX_SLEEP_MS);
await (await dao.connect(investor2).vote(id, true)).wait();
await maybeWaitFor(POST_TX_SLEEP_MS);
await (await dao.connect(investor3).vote(id, true)).wait();
await maybeWaitFor(POST_TX_SLEEP_MS);


// Finalize (may revert if DAO has rules that prevent immediate finalization)
try {
await (await dao.connect(investor1).finalizeProposal(id)).wait();
console.log(`✅ Created & Finalized Proposal ${id}`);
} catch (e) {
console.log(`ℹ️ Proposal ${id} finalize skipped/failed: ${await getReasonOrMessage(e)}`);
}
} catch (err) {
console.log(`⚠️ Error around proposal ${id}: ${await getReasonOrMessage(err)}`);
}
}


// Leave one more proposal open for UI testing
console.log("\n➡️ Creating one more proposal (left un-finalized for UI testing)...\n");
try {
await (await dao.connect(investor1).createProposal(`Proposal ${PROPOSAL_COUNT + 1}`, tokens(PROPOSAL_VALUE_ETH, 18), recipient.address)).wait();
await (await dao.connect(investor2).vote(PROPOSAL_COUNT + 1, true)).wait();
await (await dao.connect(investor3).vote(PROPOSAL_COUNT + 1, true)).wait();
console.log("✅ Extra proposal created and voted, not finalized.\n");
} catch (err) {
console.log(`⚠️ Extra proposal creation failed: ${await getReasonOrMessage(err)}`);
}


console.log("🎉 Seeding finished.\n");
}


// Execute if run directly via `node` or `npx hardhat run`
if (require.main === module) {
main().catch((error) => {
console.error(error);
process.exitCode = 1;
});
}


// Export for test harnesses if needed
module.exports = { main };
