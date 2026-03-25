const http = require("http");
const env = require("./config/env");
const logger = require("./config/logger");
const { connectDb } = require("./config/db");
const app = require("./app");
const { attachSocketIo } = require("./realtime/socket");
const { scheduleAppointmentReminders } = require("./jobs/appointmentReminders");

const server = http.createServer(app);

async function start() {
  try {
    await connectDb();
    attachSocketIo(server);
    scheduleAppointmentReminders();

    server.listen(env.port, () => {
      logger.info(`MedMap backend listening on port ${env.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server", { error: err.message });
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

start();
