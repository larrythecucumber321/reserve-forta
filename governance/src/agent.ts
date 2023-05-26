import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} from "forta-agent";
import {
  getGovernanceContract,
  getRTokenContract,
  rTokensToMonitor,
} from "./agent.utils";

// Handle block
function provideHandleBlock() {
  return async function handleBlock(this: any, blockEvent: BlockEvent) {
    const findings: Finding[] = [];
    const proposalsCreated: {
      rTokenAddress: string;
      name: string;
      event: ethers.Event;
    }[] = [];
    const proposalsExecuted: {
      rTokenAddress: string;
      name: string;
      event: ethers.Event;
    }[] = [];

    await Promise.all(
      rTokensToMonitor.map(async ({ rTokenAddress, governanceAddress }) => {
        const rToken = getRTokenContract(rTokenAddress);
        const name = await rToken.name();

        const governance = getGovernanceContract(governanceAddress);

        const eventsProposalCreated = await governance.queryFilter(
          governance.filters.ProposalCreated(),
          blockEvent.blockNumber,
          blockEvent.blockNumber
        );

        const eventsProposalExecuted = await governance.queryFilter(
          governance.filters.ProposalExecuted(),
          blockEvent.blockNumber,
          blockEvent.blockNumber
        );

        eventsProposalCreated.forEach((event) =>
          proposalsCreated.push({ rTokenAddress, name, event })
        );
        eventsProposalExecuted.forEach((event) =>
          proposalsExecuted.push({ rTokenAddress, name, event })
        );
      })
    );

    if (proposalsCreated.length > 0) {
      proposalsCreated.forEach((proposal) => {
        findings.push(
          Finding.fromObject({
            name: "Governance Proposal Creation Monitor",
            description: `Proposal created on ${proposal.name} at transaction ${proposal.event.transactionHash} with Proposal ID ${proposal.event?.args?.[0]}`,
            alertId: "RESERVE-PROPOSAL-CREATED",
            severity: FindingSeverity.Medium,
            type: FindingType.Info,
            metadata: {
              rTokenAddress: proposal.rTokenAddress,
              transactionHash: proposal.event.transactionHash,
              proposalId: proposal.event?.args?.[0].toString(),
              currentBlock: blockEvent.blockNumber.toString(),
            },
          })
        );
      });
    }

    if (proposalsExecuted.length > 0) {
      proposalsExecuted.forEach((proposal) => {
        findings.push(
          Finding.fromObject({
            name: "Governance Proposal Execution Monitor",
            description: `Proposal executed on ${proposal.name} at transaction ${proposal.event.transactionHash} with Proposal ID ${proposal.event?.args?.[0]}`,
            alertId: "RESERVE-PROPOSAL-EXECUTED",
            severity: FindingSeverity.Medium,
            type: FindingType.Info,
            metadata: {
              rTokenAddress: proposal.rTokenAddress,
              transactionHash: proposal.event.transactionHash,
              proposalId: proposal.event?.args?.[0].toString(),
              currentBlock: blockEvent.blockNumber.toString(),
            },
          })
        );
      });
    }

    return findings;
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(),
};
