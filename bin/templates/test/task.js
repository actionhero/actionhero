'use strict'

const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('Task', () => {
  describe('%%name%%', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    beforeEach(async () => {
      await api.resque.queue.connection.redis.flushdb()
    })

    test('can be enqueued', async () => {
      await api.tasks.enqueue('%%name%%', {})
      const found = await api.specHelper.findEnqueuedTasks('%%name%%')
      expect(found.length).toEqual(1)
      expect(found[0].timestamp).toBeNull()
    })
  })
})
