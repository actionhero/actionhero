'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

// Note: These tests will only run on *nix operating systems //

const fs = require('fs')
const os = require('os')
const path = require('path')
const exec = require('child_process').exec
const testDir = os.tmpdir() + path.sep + 'actionheroTestProject'
const binary = './node_modules/.bin/actionhero'
const pacakgeJSON = require(path.join(__dirname, '/../../package.json'))

let AHPath

const doBash = async (command) => {
  let fullCommand = `/bin/bash -c '${command}'`
  return new Promise((resolve, reject) => {
    exec(fullCommand, (error, stdout, stderr) => {
      if (stderr) { return reject(stderr) }
      if (error) { return reject(error) }
      return resolve(stdout)
    })
  })
}

describe('Core: Binary', () => {
  if (process.platform === 'win32') {
    console.log('*** CANNOT RUN BINARY TESTS ON WINDOWS.  Sorry. ***')
  } else {
    before(async () => {
      let sourcePackage = path.normalize(path.join(__dirname, '/../../bin/templates/package.json'))
      AHPath = path.normalize(path.join(__dirname, '/../..'))

      await doBash(`rm -rf ${testDir}`)
      await doBash(`mkdir ${testDir}`)
      await doBash(`cp ${sourcePackage} ${testDir}/package.json`)

      let data = fs.readFileSync(testDir + '/package.json').toString()
      let result = data.replace(/%%versionNumber%%/g, `file:${AHPath}`)
      fs.writeFileSync(`${testDir}/package.json`, result)
    })

    it('should have made the test dir', () => {
      expect(fs.existsSync(testDir)).to.equal(true)
      expect(fs.existsSync(testDir + '/package.json')).to.equal(true)
    })

    it('can call npm install in the new project', async () => {
      // we might get warnings about package.json locks, etc.  we want to ignore them
      await doBash(`cd ${testDir} && npm install 2> /dev/null`)
    }).timeout(60000)

    it('can generate a new project', async () => {
      await doBash(`cd ${testDir} && ${binary} generate`);

      [
        'actions',
        'actions/showDocumentation.js',
        'actions/status.js',
        'config',
        'config/api.js',
        'config/errors.js',
        'config/i18n.js',
        'config/logger.js',
        'config/redis.js',
        'config/routes.js',
        'config/servers',
        'config/tasks.js',
        'config/servers/web.js',
        'config/servers/websocket.js',
        'config/servers/socket.js',
        'pids',
        'log',
        'public',
        'public/index.html',
        'public/chat.html',
        'public/css/cosmo.css',
        'public/javascript',
        'public/logo/actionhero.png',
        'servers',
        'locales/en.json',
        'tasks',
        'test',
        'test/example.js'
      ].forEach((f) => {
        expect(fs.existsSync(testDir + '/' + f)).to.equal(true)
      })
    }).timeout(10000)

    it('can call the help command', async () => {
      let data = await doBash(`cd ${testDir} && ${binary} help`)
      expect(data).to.match(/actionhero start cluster/)
      expect(data).to.match(/Binary options:/)
      expect(data).to.match(/actionhero generate server/)
    })

    it('can call the version command', async () => {
      let data = await doBash(`cd ${testDir} && ${binary} version`)
      expect(data.trim()).to.equal(pacakgeJSON.version)
    })

    it('will show a warning with bogus input', async () => {
      try {
        await doBash(`cd ${testDir} && ${binary} not-a-thing`)
        throw new Error('should not get here')
      } catch (error) {
        expect(error).to.exist()
        expect(error.toString()).to.not.match(/should not get here/)
      }
    })

    it('can generate an action', async () => {
      await doBash(`cd ${testDir} && ${binary} generate action --name=myAction --description=my_description`)
      let data = String(fs.readFileSync(`${testDir}/actions/myAction.js`))
      expect(data).to.match(/name: 'myAction'/)
      expect(data).to.match(/description: 'my_description'/)
    })

    it('can generate a task', async () => {
      await doBash(`cd ${testDir} && ${binary} generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345`)
      let data = String(fs.readFileSync(`${testDir}/tasks/myTask.js`))
      expect(data).to.match(/name: 'myTask'/)
      expect(data).to.match(/description: 'my_description'/)
      expect(data).to.match(/queue: 'my_queue'/)
      expect(data).to.match(/frequency: 12345/)
    })

    it('can generate a CLI command', async () => {
      await doBash(`cd ${testDir} && ${binary} generate cli --name=myCommand --description=my_description --example=my_example`)
      let data = String(fs.readFileSync(`${testDir}/bin/myCommand.js`))
      expect(data).to.match(/name: 'myCommand'/)
      expect(data).to.match(/description: 'my_description'/)
      expect(data).to.match(/example: 'my_example'/)
    })

    it('can generate a server', async () => {
      await doBash(`cd ${testDir} && ${binary} generate server --name=myServer`)
      let data = String(fs.readFileSync(`${testDir}/servers/myServer.js`))
      expect(data).to.match(/canChat: true/)
      expect(data).to.match(/logConnections: true/)
      expect(data).to.match(/logExits: true/)
      expect(data).to.match(/sendWelcomeMessage: true/)
    })

    it('can generate an initializer', async () => {
      await doBash(`cd ${testDir} && ${binary} generate initializer --name=myInitializer --stopPriority=123`)
      let data = String(fs.readFileSync(`${testDir}/initializers/myInitializer.js`))
      expect(data).to.match(/loadPriority: 1000/)
      expect(data).to.match(/startPriority: 1000/)
      expect(data).to.match(/stopPriority: 123/)
      expect(data).to.match(/initialize: async function \(api\)/)
      expect(data).to.match(/start: async function \(api\)/)
      expect(data).to.match(/stop: async function \(api\)/)
    })

    it('can call npm test in the new project and not fail', async () => {
      await doBash(`cd ${testDir} && npm test`)
    }).timeout(120000)

    describe('can run a single server', () => {
      it('can boot a single server')
      it('can handle signals to reboot')
      it('can handle signals to stop')
      it('will shutdown after the alloted time')
    })

    describe('can run a cluster', () => {
      it('can handle signals to reboot (graceful)')
      it('can handle signals to reboot (hup)')
      it('can handle signals to stop')
      it('can handle signals to add a worker')
      it('can handle signals to remove a worker')
      it('can detect flapping and exit')
      it('can reboot and abosrb code changes without downtime')
    })
  }
})
