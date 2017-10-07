'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

// Note: These tests will only run on *nix operating systems //

const fs = require('fs')
const os = require('os')
const path = require('path')
const {promisify} = require('util')
const spawn = require('child_process').spawn
const request = require('request-promise-native')
const isrunning = require('is-running')
const testDir = os.tmpdir() + path.sep + 'actionheroTestProject'
const binary = './node_modules/.bin/actionhero'
const pacakgeJSON = require(path.join(__dirname, '/../../package.json'))

const port = 8080
let pid

let AHPath
const doCommand = async (command, useCwd) => {
  return new Promise((resolve, reject) => {
    if (useCwd === null || useCwd === undefined) { useCwd = true }

    let parts = command.split(' ')
    let bin = parts.shift()
    let args = parts
    let stdout = ''
    let stderr = ''

    let env = process.env
    env.PORT = port

    let cmd = spawn(bin, args, {
      cwd: useCwd ? testDir : __dirname,
      env: env
    })

    cmd.stdout.on('data', (data) => { stdout += data.toString() })
    cmd.stderr.on('data', (data) => { stderr += data.toString() })

    pid = cmd.pid

    cmd.on('close', (exitCode) => {
      if (stderr.length > 0 || exitCode !== 0) {
        let error = new Error(stderr)
        error.stderr = stderr
        error.stdout = stdout
        error.pid = pid
        error.exitCode = exitCode
        return reject(error)
      }
      return resolve({stderr, stdout, pid, exitCode})
    })
  })
}

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

describe('Core: CLI', () => {
  if (process.platform === 'win32') {
    console.log('*** CANNOT RUN CLI TESTS ON WINDOWS.  Sorry. ***')
  } else {
    before(async () => {
      if (process.env.SKIP_CLI_TEST_SETUP === 'true') { return }

      let sourcePackage = path.normalize(path.join(__dirname, '/../../bin/templates/package.json'))
      AHPath = path.normalize(path.join(__dirname, '/../..'))

      await doCommand(`rm -rf ${testDir}`, false)
      await doCommand(`mkdir -p ${testDir}`, false)
      await doCommand(`cp ${sourcePackage} ${testDir}/package.json`)

      let data = fs.readFileSync(testDir + '/package.json').toString()
      let result = data.replace(/%%versionNumber%%/g, `file:${AHPath}`)
      fs.writeFileSync(`${testDir}/package.json`, result)
    })

    it('should have made the test dir', () => {
      expect(fs.existsSync(testDir)).to.equal(true)
      expect(fs.existsSync(testDir + '/package.json')).to.equal(true)
    })

    it('can call npm install in the new project', async () => {
      try {
        await doCommand(`npm install`)
      } catch (error) {
        // we might get warnings about package.json locks, etc.  we want to ignore them
        if (error.toString().indexOf('npm') < 0) { throw error }
        expect(error.exitCode).to.equal(0)
      }
    }).timeout(60000)

    it('can generate a new project', async () => {
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
        'test',
        'test/example.js'
      ].forEach((f) => {
        expect(fs.existsSync(testDir + '/' + f)).to.equal(true)
      })
    }).timeout(10000)

    it('can call the help command', async () => {
      let {stdout} = await doCommand(`${binary} help`)
      expect(stdout).to.match(/actionhero start cluster/)
      expect(stdout).to.match(/The reusable, scalable, and quick node.js API server for stateless and stateful applications/)
      expect(stdout).to.match(/actionhero generate server/)
    })

    it('can call the version command', async () => {
      let {stdout} = await doCommand(`${binary} version`)
      expect(stdout).to.contain(pacakgeJSON.version)
    })

    it('will show a warning with bogus input', async () => {
      try {
        await doCommand(`${binary} not-a-thing`)
        throw new Error('should not get here')
      } catch (error) {
        expect(error).to.exist()
        expect(error.exitCode).to.equal(1)
        expect(error.stderr).to.match(/`not-a-thing` is not a method I can perform/)
        expect(error.stderr).to.match(/run `actionhero help` to learn more/)
      }
    })

    it('can generate an action', async () => {
      await doCommand(`${binary} generate action --name=myAction --description=my_description`)
      let data = String(fs.readFileSync(`${testDir}/actions/myAction.js`))
      expect(data).to.match(/this.name = 'myAction'/)
      expect(data).to.match(/this.description = 'my_description'/)
    })

    it('can generate a task', async () => {
      await doCommand(`${binary} generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345`)
      let data = String(fs.readFileSync(`${testDir}/tasks/myTask.js`))
      expect(data).to.match(/this.name = 'myTask'/)
      expect(data).to.match(/this.description = 'my_description'/)
      expect(data).to.match(/this.queue = 'my_queue'/)
      expect(data).to.match(/this.frequency = 12345/)
    })

    it('can generate a CLI command', async () => {
      await doCommand(`${binary} generate cli --name=myCommand --description=my_description --example=my_example`)
      let data = String(fs.readFileSync(`${testDir}/bin/myCommand.js`))
      expect(data).to.match(/this.name = 'myCommand'/)
      expect(data).to.match(/this.description = 'my_description'/)
      expect(data).to.match(/this.example = 'my_example'/)
    })

    it('can generate a server', async () => {
      await doCommand(`${binary} generate server --name=myServer`)
      let data = String(fs.readFileSync(`${testDir}/servers/myServer.js`))
      expect(data).to.match(/this.type = 'myServer'/)
      expect(data).to.match(/canChat: false/)
      expect(data).to.match(/logConnections: true/)
      expect(data).to.match(/logExits: true/)
      expect(data).to.match(/sendWelcomeMessage: false/)
    })

    it('can generate an initializer', async () => {
      await doCommand(`${binary} generate initializer --name=myInitializer --stopPriority=123`)
      let data = String(fs.readFileSync(`${testDir}/initializers/myInitializer.js`))
      expect(data).to.match(/this.loadPriority = 1000/)
      expect(data).to.match(/this.startPriority = 1000/)
      expect(data).to.match(/this.stopPriority = 123/)
      expect(data).to.match(/async initialize \(\) {/)
      expect(data).to.match(/async start \(\) {/)
      expect(data).to.match(/async stop \(\) {/)
    })

    it('can call npm test in the new project and not fail', async () => {
      await doCommand(`npm test`)
    }).timeout(120000)

    // NOTE: To run these tests, don't await! It will be fine... what could go wrong?
    describe('can run a single server', () => {
      let serverPid
      before(async function () {
        doCommand(`${binary} start`)
        await sleep(3000)
        serverPid = pid
      })

      after(async () => {
        if (isrunning(serverPid)) { await doCommand(`kill ${serverPid}`) }
      })

      it('can boot a single server', async () => {
        let response = await request(`http://localhost:${port}/api/showDocumentation`, {json: true})
        expect(response.serverInformation.serverName).to.equal('my_actionhero_project')
      })

      it('can handle signals to reboot', async () => {
        await doCommand(`kill -s USR2 ${serverPid}`)
        await sleep(3000)
        let response = await request(`http://localhost:${port}/api/showDocumentation`, {json: true})
        expect(response.serverInformation.serverName).to.equal('my_actionhero_project')
      })

      it('can handle signals to stop', async () => {
        await doCommand(`kill ${serverPid}`)
        await sleep(3000)
        try {
          await request(`http://localhost:${port}/api/showDocumentation`)
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).to.match(/ECONNREFUSED/)
        }
      })

      it('will shutdown after the alloted time')
    })

    describe('can run a cluster', () => {
      let clusterPid
      before(async function () {
        doCommand(`${binary} start cluster --workers=2`)
        await sleep(3000)
        clusterPid = pid
      })

      after(async () => {
        if (isrunning(clusterPid)) { await doCommand(`kill ${clusterPid}`) }
      })

      it('should be running the cluster with 2 nodes', async () => {
        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(1)
        expect(children.length).to.equal(2)

        let response = await request(`http://localhost:${port}/api/showDocumentation`, {json: true})
        expect(response.serverInformation.serverName).to.equal('my_actionhero_project')
      })

      it('can handle signals to add a worker', async () => {
        await doCommand(`kill -s TTIN ${clusterPid}`)
        await sleep(1000)

        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(1)
        expect(children.length).to.equal(3)
      })

      it('can handle signals to remove a worker', async () => {
        await doCommand(`kill -s TTOU ${clusterPid}`)
        await sleep(1000)

        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('bin/actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(1)
        expect(children.length).to.equal(2)
      })

      it('can handle signals to reboot (graceful)', async () => {
        await doCommand(`kill -s USR2 ${clusterPid}`)
        await sleep(2000)

        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(1)
        expect(children.length).to.equal(2)

        let response = await request(`http://localhost:${port}/api/showDocumentation`, {json: true})
        expect(response.serverInformation.serverName).to.equal('my_actionhero_project')
      })

      it('can handle signals to reboot (hup)', async () => {
        await doCommand(`kill -s WINCH ${clusterPid}`)
        await sleep(2000)

        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(1)
        expect(children.length).to.equal(2)

        let response = await request(`http://localhost:${port}/api/showDocumentation`, {json: true})
        expect(response.serverInformation.serverName).to.equal('my_actionhero_project')
      })

      it('can handle signals to stop', async () => {
        await doCommand(`kill ${clusterPid}`)
        await sleep(2000)

        let {stdout} = await doCommand(`ps awx`)
        let parents = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start cluster') >= 0 })
        let children = stdout.split('\n').filter((l) => { return l.indexOf('actionhero start') >= 0 && l.indexOf('cluster') < 0 })
        expect(parents.length).to.equal(0)
        expect(children.length).to.equal(0)
      })

      it('can detect flapping and exit')
      it('can reboot and abosrb code changes without downtime')
    })
  }
})
