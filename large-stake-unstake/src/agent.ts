import {
  BlockEvent,
  Finding,
  Initialize,
  HandleBlock,
  HandleTransaction,
  HandleAlert,
  AlertEvent,
  TransactionEvent,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} from "forta-agent";

export const ERC20_TRANSFER_EVENT =
  "event Transfer(address indexed from, address indexed to, uint256 value)";
export const TARGET_CONTRACT_ADDRESS =
  "0xF014FEF41cCB703975827C8569a3f0940cFD80A4";

const ERC20_ABI = ["function decimals() view returns (uint256)"];
let findingsCount = 0;

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;

  // filter the transaction logs for ERC20 transfer events to the TARGET_CONTRACT_ADDRESS
  const transferEvents = txEvent.filterLog(ERC20_TRANSFER_EVENT);

  await Promise.all(
    transferEvents.map(async ({ address, args }) => {
      // extract transfer event arguments
      const { to, from, value } = args;

      const contract = new ethers.Contract(
        address,
        ERC20_ABI,
        getEthersProvider()
      );
      const decimals = await contract.decimals();
      // shift decimals of transfer value
      const normalizedValue = value.div((10 ** decimals).toString());

      // if the transfer is to the TARGET_CONTRACT_ADDRESS and more than 10,000 tokens were transferred, report it
      if (to === TARGET_CONTRACT_ADDRESS && normalizedValue.gt(100000)) {
        findings.push(
          Finding.fromObject({
            name: "High ERC20 Token Transfer",
            description: `High amount of ERC20 tokens transferred to ${to}: ${normalizedValue.toString()}`,
            alertId: "FORTA-1",
            severity: FindingSeverity.Low,
            type: FindingType.Info,
            metadata: {
              to,
              from,
              value: value.toString(),
              tokenAddress: address,
            },
          })
        );
        findingsCount++;
      }
    })
  );

  return findings;
};

export default {
  handleTransaction,
};
