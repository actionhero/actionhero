import { Action, ParamsFrom } from "./../index";

function sleep(time: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export class SleepTest extends Action {
  name = "sleepTest";
  description = "I will sleep and then return";
  inputs = {
    sleepDuration: {
      required: true as true,
      formatter: parseInt,
      default: () => {
        return 1000;
      },
    },
  };
  outputExample = {
    sleepStarted: 1420953571322,
    sleepEnded: 1420953572327,
    sleepDelta: 1005,
    sleepDuration: 1000,
  };

  async run({ params }: { params: ParamsFrom<SleepTest> }) {
    const sleepDuration = params.sleepDuration;
    const sleepStarted = new Date().getTime();

    await sleep(sleepDuration);
    const sleepEnded = new Date().getTime();
    const sleepDelta = sleepEnded - sleepStarted;

    return { sleepStarted, sleepEnded, sleepDelta, sleepDuration };
  }
}
