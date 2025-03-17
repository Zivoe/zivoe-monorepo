declare module 'ethereum-block-by-date' {
  import { PublicClient } from 'viem';

  export default class EthDater {
    constructor(provider: PublicClient);
    getDate(date: string | number | Date, after?: boolean, refresh?: boolean): Promise<any>;
  }
}
