const startedAt = Date.now();
let relayCommandsTotal = 0;
let relayResponsesTotal = 0;
let relayErrorsTotal = 0;
const activeTransfers = new Set<string>();
const transferStarts = new Map<string, bigint>();
let transferDurationSecondsSum = 0;
let transferDurationSecondsCount = 0;

function getRequestId(message: unknown): string | null {
  if (
    typeof message === "object" &&
    message !== null &&
    "requestId" in message &&
    typeof message.requestId === "string"
  ) {
    return message.requestId;
  }

  return null;
}

export function recordRelayCommand(message: unknown) {
  relayCommandsTotal += 1;

  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message.type === "DOWNLOAD_FILE" || message.type === "UPLOAD_FILE")
  ) {
    const requestId = getRequestId(message);
    if (requestId) {
      activeTransfers.add(requestId);
      transferStarts.set(requestId, process.hrtime.bigint());
    }
  }
}

export function recordRelayResponse(message: unknown) {
  relayResponsesTotal += 1;

  if (typeof message !== "object" || message === null || !("type" in message)) {
    return;
  }

  const requestId = getRequestId(message);
  if (!requestId) {
    return;
  }

  const isComplete =
    (message.type === "FILE_CHUNK" && "final" in message && message.final === true) ||
    message.type === "UPLOAD_ACK" ||
    message.type === "ERROR";

  if (!isComplete) {
    return;
  }

  activeTransfers.delete(requestId);
  const started = transferStarts.get(requestId);
  transferStarts.delete(requestId);

  if (started) {
    const elapsedNs = process.hrtime.bigint() - started;
    transferDurationSecondsSum += Number(elapsedNs) / 1_000_000_000;
    transferDurationSecondsCount += 1;
  }
}

export function recordRelayError() {
  relayErrorsTotal += 1;
}

export function renderMetrics(connectedAgents: number): string {
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);

  return [
    "# HELP cloudbox_gateway_uptime_seconds Gateway process uptime in seconds.",
    "# TYPE cloudbox_gateway_uptime_seconds gauge",
    `cloudbox_gateway_uptime_seconds ${uptimeSeconds}`,
    "# HELP cloudbox_gateway_connected_agents Connected authenticated agents.",
    "# TYPE cloudbox_gateway_connected_agents gauge",
    `cloudbox_gateway_connected_agents ${connectedAgents}`,
    "# HELP cloudbox_gateway_active_transfers Active upload/download transfers through the gateway.",
    "# TYPE cloudbox_gateway_active_transfers gauge",
    `cloudbox_gateway_active_transfers ${activeTransfers.size}`,
    "# HELP cloudbox_gateway_relay_commands_total Redis relay commands received by the gateway.",
    "# TYPE cloudbox_gateway_relay_commands_total counter",
    `cloudbox_gateway_relay_commands_total ${relayCommandsTotal}`,
    "# HELP cloudbox_gateway_relay_responses_total Agent responses published back to Redis.",
    "# TYPE cloudbox_gateway_relay_responses_total counter",
    `cloudbox_gateway_relay_responses_total ${relayResponsesTotal}`,
    "# HELP cloudbox_gateway_relay_errors_total Gateway relay errors.",
    "# TYPE cloudbox_gateway_relay_errors_total counter",
    `cloudbox_gateway_relay_errors_total ${relayErrorsTotal}`,
    "# HELP cloudbox_gateway_transfer_duration_seconds_sum Total completed transfer duration in seconds.",
    "# TYPE cloudbox_gateway_transfer_duration_seconds_sum counter",
    `cloudbox_gateway_transfer_duration_seconds_sum ${transferDurationSecondsSum.toFixed(6)}`,
    "# HELP cloudbox_gateway_transfer_duration_seconds_count Completed transfer count.",
    "# TYPE cloudbox_gateway_transfer_duration_seconds_count counter",
    `cloudbox_gateway_transfer_duration_seconds_count ${transferDurationSecondsCount}`,
    "",
  ].join("\n");
}
