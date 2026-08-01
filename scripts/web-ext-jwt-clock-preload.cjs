const seconds = Number.parseInt(process.env.WEB_EXT_JWT_BACKDATE_SECONDS || '0', 10);

if (Number.isFinite(seconds) && seconds > 0) {
  const OriginalDate = Date;
  const originalNow = OriginalDate.now.bind(OriginalDate);
  const offsetMs = seconds * 1000;

  class BackdatedDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(originalNow() - offsetMs);
      } else {
        super(...args);
      }
    }

    static now() {
      return originalNow() - offsetMs;
    }

    static parse(value) {
      return OriginalDate.parse(value);
    }

    static UTC(...args) {
      return OriginalDate.UTC(...args);
    }
  }

  global.Date = BackdatedDate;
}
