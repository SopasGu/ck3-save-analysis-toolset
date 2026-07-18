import {
  buildAdvisorPacket,
} from './ck3-save-advisor.mjs';

export function buildBriefConsumerContext(input, options = {}) {
  const packet = buildAdvisorPacket(input, {
    question: options.question ?? 'brief advisor context for current CK3 save',
    generatedAt: options.generatedAt,
    advisorDir: options.advisorDir,
    mechanicsDir: options.mechanicsDir,
    graphPath: options.graphPath,
  });

  return {
    schemaVersion: 1,
    kind: 'ck3_report_consumer_context',
    report: 'brief',
    epistemicLayer: 'E consumers',
    generatedAt: packet.generatedAt,
    sourceInput: packet.evidence.sourceInput,
    route: packet.route,
    advisorModel: {
      id: packet.advisorModel.id,
      path: packet.route.advisorPath,
      graphIds: packet.advisorModel.graphIds,
      sourceIds: packet.advisorModel.sourceIds,
      inspectionHeadings: packet.advisorModel.inspectionHeadings,
    },
    mechanics: packet.mechanics.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      path: source.path,
      oldidUrl: source.oldidUrl,
    })),
    reportGrounding: {
      reportFields: packet.reports.brief.fields,
      currentSaveEvidence: packet.evidence.currentSave
        .filter((entry) => entry.reportField.startsWith('brief.') || entry.reportField.startsWith('snapshot.')),
    },
    comparison: {
      baselineReport: 'brief',
      changedFields: [],
      discrepancies: [],
      discrepancyCategories: [
        'bug',
        'unsupported_structure',
        'semantic_disagreement',
        'expected_output_change',
      ],
      note: 'Task 13 pilot: the legacy brief payload is preserved; this context records durable advisor/schema grounding for migration review.',
    },
    boundaries: [
      'This context is a consumer surface over durable graph/wiki knowledge; it does not define schema truth.',
      'Current-save facts remain ephemeral and are grounded by report fields plus save paths.',
    ],
  };
}
