import dayjs from './src/utils/dayjsSetup';

const TEST_TIMESTAMP = Date.UTC(2026, 0, 28, 22, 30, 0);
console.log("Local:", dayjs(TEST_TIMESTAMP).format('hh:mm A'));
console.log("TZ (default):", dayjs.tz(TEST_TIMESTAMP).format('hh:mm A'));
console.log("TZ (method):", dayjs(TEST_TIMESTAMP).tz().format('hh:mm A'));
