/**
 * Cửa ngõ công khai của tầng realtime.
 *
 * Code bên ngoài chỉ cần import từ "./live.js" như trước; phần cài đặt nằm trong
 * src/realtime/ để dễ đọc và sửa từng phần (state, sync, command, websocket).
 */
export { getLatestTelemetry, getLiveStats } from "./realtime/state.js";
export { trackCommand } from "./realtime/commands.js";
export { startLive, stopLive } from "./realtime/live-service.js";
