import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent,
  ethers,
} from "forta-agent";

// The address of SlowWallet contract
const slowWalletAddress = "0xYourContractAddressHere";

// Define the ABI of the event we're interested in
const slowWalletAbi = [
  "event TransferProposed(uint256 indexed index, address indexed destination, uint256 value, uint256 delayUntil, string notes)",
];

// Instantiate ethers.utils.Interface to decode the event data
const slowWalletInterface = new ethers.utils.Interface(slowWalletAbi);

function provideHandleTransaction() {
  return async function handleTransaction(txEvent: TransactionEvent) {
    const findings: Finding[] = [];

    // Check if the transaction is related to the SlowWallet contract
    if (txEvent.addresses[slowWalletAddress]) {
      // Parse the logs in the transaction
      for (const log of txEvent.logs) {
        // Only proceed if the log is from the SlowWallet contract
        if (log.address === slowWalletAddress) {
          const parsedLog = slowWalletInterface.parseLog(log);

          // If this is a TransferProposed event, create a finding
          if (parsedLog.name === "TransferProposed") {
            findings.push(
              Finding.fromObject({
                name: "SlowWallet Transfer Proposed",
                description: `Transfer of ${parsedLog.args.value.toString()} tokens proposed to ${
                  parsedLog.args.destination
                } (index ${parsedLog.args.index.toString()})`,
                alertId: "N/A",
                severity: FindingSeverity.Info,
                type: FindingType.Info,
                protocol: "ethereum",
                metadata: {
                  index: parsedLog.args.index.toString(),
                  destination: parsedLog.args.destination,
                  value: parsedLog.args.value.toString(),
                  delayUntil: parsedLog.args.delayUntil.toString(),
                  notes: parsedLog.args.notes,
                },
              })
            );
          }
        }
      }
    }

    return findings;
  };
}

module.exports = {
  provideHandleTransaction,
  handleTransaction: provideHandleTransaction(),
};
