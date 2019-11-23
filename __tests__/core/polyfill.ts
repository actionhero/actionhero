import { Process } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Ployfill", () => {
    beforeAll(async () => {
        api = await actionhero.start();
    });

    afterAll(async () => {
        await actionhero.stop();
    });

    test('should have api object with legacy parts', () => {
        [
            api.utils,
            api.cache,
            api.tasks,
            api.actions,
            api.resque
        ].forEach(item => {
            expect(item).toBeInstanceOf(Object);
        });

        expect(api.log).toBeInstanceOf(Function);
    })
})
