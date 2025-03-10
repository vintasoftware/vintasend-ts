import { WinstonLogger } from '../index';
import * as winston from 'winston';


jest.mock('winston', () => ({
  createLogger: jest.fn(),
  transports: {
    Console: jest.fn(),
  },
  format: {
    simple: jest.fn(),
  },
}));

describe('WinstonLogger', () => {
  let mockLogger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock, add: jest.Mock };
  let winstonLogger: WinstonLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      add: jest.fn(),
    };
    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);
    winstonLogger = new WinstonLogger();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default options', () => {
    expect(winston.createLogger).toHaveBeenCalledWith({});
  });

  it('should initialize with custom options', () => {
    const options = { level: 'info' };
    new WinstonLogger(options);
    expect(winston.createLogger).toHaveBeenCalledWith(options);
  });

  it('should add console transport in development environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    new WinstonLogger();

    expect(winston.transports.Console).toHaveBeenCalledWith({
      format: undefined, // because format.simple() is mocked
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should log info messages', () => {
    const message = 'test info message';
    winstonLogger.info(message);
    expect(mockLogger.info).toHaveBeenCalledWith(message);
  });

  it('should log error messages', () => {
    const message = 'test error message';
    winstonLogger.error(message);
    expect(mockLogger.error).toHaveBeenCalledWith(message);
  });

  it('should log warning messages', () => {
    const message = 'test warning message';
    winstonLogger.warn(message);
    expect(mockLogger.warn).toHaveBeenCalledWith(message);
  });
});
