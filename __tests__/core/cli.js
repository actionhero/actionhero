'use strict'

// Note: These tests will only run on *nix operating systems //

const fs = require('fs')
const os = require('os')
const path = require('path')
const spawn = require('child_process').spawn
const request = require('request-promise-native')
const isrunning = require('is-running')
const testDir = os.tmpdir() + path.sep + 'actionheroTestProject'
const binary = './node_modules/.bin/actionhero'
const pacakgeJSON = require(path.join(__dirname, '/../../package.json'))

const port = 18080 + parseInt(process.env.JEST_WORKER_ID || 0)
let pid

let AHPath
const doCommand = async (command, useCwd) => {
  return new Promise((resolve, reject) => {
    if (useCwd === null || useCwd === undefined) { useCwd = true }

    const parts = command.split(' ')
    const bin = parts.shift()
    const args = parts
    let stdout = ''
    let stderr = ''

    const env = process.env

    const cmd = spawn(bin, args, {
      cwd: useCwd ? testDir : __dirname,
      env: env
    })

    cmd.stdout.on('data', (data) => { stdout += data.toString() })
    cmd.stderr.on('data', (data) => { stderr += data.toString() })

    pid = cmd.pid

    cmd.on('close', (exitCode) => {
      // running jest in a sub-shell returns the output as stderr, so we need to filter it
      if ((stderr.length > 0 && stderr.indexOf('✓') < 0) || exitCode !== 0) {
        const error = new Error(stderr)
        error.stderr = stderr
        error.stdout = stdout
        error.pid = pid
        error.exitCode = exitCode
        return reject(error)
      }
      return resolve({ stderr, stdout, pid, exitCode })
    })
  })
}

async function sleep (time) {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

describe('Core: CLI', () => {
  if (process.platform === 'win32') {
    console.log('*** CANNOT RUN CLI TESTS ON WINDOWS.  Sorry. ***')
  } else {
    beforeAll(async () => {
      if (process.env.SKIP_CLI_TEST_SETUP === 'true') { return }

      const sourcePackage = path.normalize(path.join(__dirname, '/../../bin/templates/package.json'))
      AHPath = path.normalize(path.join(__dirname, '/../..'))

      await doCommand(`rm -rf ${testDir}`, false)
      await doCommand(`mkdir -p ${testDir}`, false)
      await doCommand(`cp ${sourcePackage} ${testDir}/package.json`)

      const data = fs.readFileSync(testDir + '/package.json').toString()
      const result = data.replace(/%%versionNumber%%/g, `file:${AHPath}`)
      fs.writeFileSync(`${testDir}/package.json`, result)
    })

    test('should have made the test dir', () => {
      expect(fs.existsSync(testDir)).toEqual(true)
      expect(fs.existsSync(testDir + '/package.json')).toEqual(true)
    })

    test('can call npm install in the new project', async () => {
      try {
        await doCommand('npm install')
      } catch (error) {
        // we might get warnings about package.json locks, etc.  we want to ignore them
        if (error.toString().indexOf('npm') < 0) { throw error }
        expect(error.exitCode).toEqual(0)
      }
    }, 60000)

    test('can generate a new project', async () => {
      await doCommand(`${binary} generate`);

      [
        'actions',
        'actions/showDocumentation.js',
        'actions/status.js',
        'config',
        'config/api.js',
        'config/errors.js',
        'config/i18n.js',
        'config/plugins.js',
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
        '__tests__',
        '__tests__/example.js',
        '.gitignore',
        'boot.js'
      ].forEach((f) => {
        expect(fs.existsSync(testDir + '/' + f)).toEqual(true)
      })
    }, 10000)

    test('can call the help command', async () => {
      const { stdout } = await doCommand(`${binary} help`)
      expect(stdout).toMatch(/actionhero start cluster/)
      expect(stdout).toMatch(/The reusable, scalable, and quick node.js API server for stateless and stateful applications/)
      expect(stdout).toMatch(/actionhero generate server/)
    })

    test('can call the version command', async () => {
      const { stdout } = await doCommand(`${binary} version`)
      expect(stdout).toContain(pacakgeJSON.version)
    })

    test('will show a warning with bogus input', async () => {
      try {
        await doCommand(`${binary} not-a-thing`)
        throw new Error('should not get here')
      } catch (error) {
        expect(error).toBeTruthy()
        expect(error.exitCode).toEqual(1)
        expect(error.stderr).toMatch(/`not-a-thing` is not a method I can perform/)
        expect(error.stderr).toMatch(/run `actionhero help` to learn more/)
      }
    })

    test('can generate an action', async () => {
      await doCommand(`${binary} generate action --name=myAction --description=my_description`)
      const data = String(fs.readFileSync(`${testDir}/actions/myAction.js`))
      expect(data).toMatch(/this.name = 'myAction'/)
      expect(data).toMatch(/this.description = 'my_description'/)
    })

    test('can generate a task', async () => {
      await doCommand(`${binary} generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345`)
      const data = String(fs.readFileSync(`${testDir}/tasks/myTask.js`))
      expect(data).toMatch(/this.name = 'myTask'/)
      expect(data).toMatch(/this.description = 'my_description'/)
      expect(data).toMatch(/this.queue = 'my_queue'/)
      expect(data).toMatch(/this.frequency = 12345/)
    })

    test('can generate a CLI command', async () => {
      await doCommand(`${binary} generate cli --name=myCommand --description=my_description --example=my_example`)
      const data = String(fs.readFileSync(`${testDir}/bin/myCommand.js`))
      expect(data).toMatch(/this.name = 'myCommand'/)
      expect(data).toMatch(/this.description = 'my_description'/)
      expect(data).toMatch(/this.example = 'my_example'/)
    })

    test('can generate a server', async () => {
      await doCommand(`${binary} generate server --name=myServer`)
      const data = String(fs.readFileSync(`${testDir}/servers/myServer.js`))
      expect(data).toMatch(/this.type = 'myServer'/)
      expect(data).toMatch(/canChat: false/)
      expect(data).toMatch(/logConnections: true/)
      expect(data).toMatch(/logExits: true/)
      expect(data).toMatch(/sendWelcomeMessage: false/)
    })

    test('can generate an initializer', async () => {
      await doCommand(`${binary} generate initializer --name=myInitializer --stopPriority=123`)
      const data = String(fs.readFileSync(`${testDir}/initializers/myInitializer.js`))
      expect(data).toMatch(/this.loadPriority = 1000/)
      expect(data).toMatch(/this.startPriority = 1000/)
      expect(data).toMatch(/this.stopPriority = 123/)
      expect(data).toMatch(/async initialize \(\) {/)
      expect(data).toMatch(/async start \(\) {/)
      expect(data).toMatch(/async stop \(\) {/)
    })

    test('can ensure no boot.js does not break, will console.log message', async () => {
      const origBootjs = String(fs.readFileSync(`${testDir}/boot.js`))
      await doCommand(`rm ${testDir}/boot.js`, false)

      const { stdout } = await doCommand(`${binary} version`)
      expect(stdout).toContain(pacakgeJSON.version)
      expect({ stdout, start: stdout.startsWith('No boot.js specified. Skipping.') }).toEqual({ stdout, start: true })
      // replace with orig boot.js
      fs.writeFileSync(`${testDir}/boot.js`, origBootjs)
    })

    test('can ensure a custom boot.js runs before everything else', async () => {
      const origBootjs = String(fs.readFileSync(`${testDir}/boot.js`))
      fs.writeFileSync(`${testDir}/boot.js`, `module.exports = async function() {
        await new Promise((resolve)=> setTimeout(resolve,500))
        console.log('BOOTING')
      }`)

      const { stdout } = await doCommand(`${binary} version`)
      expect({ stdout, start: stdout.startsWith('BOOTING') }).toEqual({ stdout, start: true })
      expect(stdout).toContain(pacakgeJSON.version)
      // replace with orig boot.js
      fs.writeFileSync(`${testDir}/boot.js`, origBootjs)
    })

    test('can call npm test in the new project and not fail', async () => {
      await doCommand('npm test')
    }, 120000)

    describe('can run a single server', () => {
      // NOTE: To run these tests, don't await! It will be fine... what could go wrong?
      let serverPid

      beforeAll(async function () {
        doCommand(`${binary} start`)
        await sleep(3000)
        serverPid = pid
      })

      afterAll(async () => {
        if (isrunning(serverPid)) { await doCommand(`kill ${serverPid}`) }
      })

      test('can boot a single server', async () => {
        const response = await request(`http://localhost:${port}/api/showDocumentation`, { json: true })
        expect(response.serverInformation.serverName).toEqual('my_actionhero_project')
      })

      test('can handle signals to reboot', async () => {
        await doCommand(`kill -s USR2 ${serverPid}`)
        await sleep(3000)
        const response = await request(`http://localhost:${port}/api/showDocumentation`, { json: true })
        expect(response.serverInformation.serverName).toEqual('my_actionhero_project')
      })

      test('can handle signals to stop', async () => {
        await doCommand(`kill ${serverPid}`)
        await sleep(3000)
        try {
          await request(`http://localhost:${port}/api/showDocumentation`)
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toMatch(/ECONNREFUSED/)
        }
      })

      // test('will shutdown after the alloted time')
    })

    describe('can run a cluster', () => {
      let clusterPid
      beforeAll(async function () {
        doCommand(`${binary} start cluster --workers=2`)
        await sleep(3000)
        clusterPid = pid
      })

      afterAll(async () => {
        if (isrunning(clusterPid)) { await doCommand(`kill ${clusterPid}`) }
      })

      test('should be running the cluster with 2 nodes', async () => {
        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(1)
        expect(children.length).toEqual(2)

        const response = await request(`http://localhost:${port}/api/showDocumentation`, { json: true })
        expect(response.serverInformation.serverName).toEqual('my_actionhero_project')
      })

      test('can handle signals to add a worker', async () => {
        await doCommand(`kill -s TTIN ${clusterPid}`)
        await sleep(2500)

        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(1)
        expect(children.length).toEqual(3)
      })

      test('can handle signals to remove a worker', async () => {
        await doCommand(`kill -s TTOU ${clusterPid}`)
        await sleep(2500)

        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(1)
        expect(children.length).toEqual(2)
      })

      test('can handle signals to reboot (graceful)', async () => {
        await doCommand(`kill -s USR2 ${clusterPid}`)
        await sleep(2000)

        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(1)
        expect(children.length).toEqual(2)

        const response = await request(`http://localhost:${port}/api/showDocumentation`, { json: true })
        expect(response.serverInformation.serverName).toEqual('my_actionhero_project')
      })

      test('can handle signals to reboot (hup)', async () => {
        await doCommand(`kill -s WINCH ${clusterPid}`)
        await sleep(2000)

        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(1)
        expect(children.length).toEqual(2)

        const response = await request(`http://localhost:${port}/api/showDocumentation`, { json: true })
        expect(response.serverInformation.serverName).toEqual('my_actionhero_project')
      })

      test('can handle signals to stop', async () => {
        await doCommand(`kill ${clusterPid}`)
        await sleep(2000)

        const { stdout } = await doCommand('ps awx')
        const parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        const children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).toEqual(0)
        expect(children.length).toEqual(0)
      })

      // test('can detect flapping and exit')
      // test('can reboot and abosrb code changes without downtime')
    })
  }
})
