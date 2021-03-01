export const log = (status: string, seperator?: boolean): void => {
  console.log(`[${new Date().toLocaleTimeString()}]: ${status}`);
  if (seperator) {
    logSeperator();
  }
};

export const logSeperator = (): void => { console.log('############################################################'); };
