import { Action } from "./../index";

function sleep(time: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export class SleepTest extends Action {
  constructor() {
    super();
    this.name = "sleepTest";
    this.description = "I will sleep and then return";
    this.inputs = {
      sleepDuration: {
        required: true,
        formatter: (n: string) => {
          return parseInt(n);
        },
        default: () => {
          return 1000;
        },
      },
    };
    this.outputExample = {
      sleepStarted: 1420953571322,
      sleepEnded: 1420953572327,
      sleepDelta: 1005,
      sleepDuration: 1000,
    };
  }

  async run({ params }: { params: { sleepDuration: number } }) {
    const sleepDuration = params.sleepDuration;
    const sleepStarted = new Date().getTime();

    await sleep(sleepDuration);
    const sleepEnded = new Date().getTime();
    const sleepDelta = sleepEnded - sleepStarted;

    return { sleepStarted, sleepEnded, sleepDelta, sleepDuration };
  }
}
