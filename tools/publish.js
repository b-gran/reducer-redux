/*
 * Publish the package to npm.
 *
 * Usage:
 *    node publish.js [-n | --dry-run]
 */

const R = require('ramda')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync
const noop = () => {}

const rollup = require('rollup')
const commonjs = require('rollup-plugin-commonjs')
const nodeResolve = require('rollup-plugin-node-resolve')

// Root of the entire repository.
const PATH_REPO_ROOT = path.join(__dirname, '..')

// Shorthand for paths within the dist directory, where dist() === PATH_DIST
const PATH_DIST = path.join(PATH_REPO_ROOT, 'dist')
const dist = R.partial(path.join, [ PATH_DIST ])

// CONFIG ===============================================
// These options can be changed without modifying the
// basic publishing process.

// Source file that the bundle is generated from.
const ENTRY_POINT = path.join(PATH_REPO_ROOT, 'src', 'reducer.js')

// END CONFIG ===========================================

const ensureTwoDigit = R.pipe(
  Math.trunc,
  R.when(R.lt(R.__, 10), R.concat('0')),
  String
)

// Prints a message to the console with a timestamp prefixed.
const formatTime = R.pipe(
  R.constructN(0, Date),
  R.juxt([ R.invoker(0, 'getHours'), R.invoker(0, 'getMinutes'), R.invoker(0, 'getSeconds' )]),
  R.map(ensureTwoDigit),
  R.invoker(1, 'join')(':')
)
const log = (...messages) => console.log(chalk.blue(`[${formatTime()}]`), ...messages)
const logWithColor = color => R.pipe(
  R.unapply(R.map(color)),
  R.apply(log)
)
log.info = logWithColor(chalk.green)
log.warn = logWithColor(chalk.yellow)
log.error = logWithColor(chalk.red)

// Run a series of functions. Just like a pipe() called with 0 arguments.
const all = R.pipe(
  R.unapply(R.call(R.apply(R.pipe), R.__)),
  R.call
)

// Synchronously remove a directory and all children.
const isDirectory = R.pipe(R.unary(fs.lstatSync), R.invoker(0, 'isDirectory'))
function remove (filePath) {
  return R.ifElse(isDirectory)
  (filePath => {
    // Remove (recursively) each file in the directory
    fs.readdirSync(filePath).forEach(R.pipe(
      R.unary(R.partial(path.join, [ filePath ])),
      path.resolve,
      remove
    ))

    // Delete the directory
    fs.rmdirSync(filePath)
  })

  // Just remove non-directory files directly
  (R.unary(fs.unlinkSync))
  (filePath)
}

// Log an error message and exit with an error code.
const die = R.pipe(log.error, process.exit.bind(process, 1))

// Do a synchronous operation and exit if the operation fails.
const must = R.tryCatch(R.__, die)

// Do a synchronous operation, ignoring any errors.
const attempt = R.tryCatch(R.__, noop)

// Synchronously write a file to disk with utf-8 encoding.
const write = R.curryN(3, fs.writeFileSync)(R.__, R.__, 'utf-8')

// Synchronously copy a file from one location to another.
const copy = R.curry((filePath, destinationPath) => {
  const contents = fs.readFileSync(filePath)
  return fs.writeFileSync(destinationPath, contents)
})

const packageJson = require(path.join(PATH_REPO_ROOT, 'package.json'))
const isDryRun = R.any(R.anyPass([ R.equals('-n'), R.equals('--dry-run') ]), Array.from(process.argv))
const omitDevelopmentKeys = R.omit([ 'devDependencies', 'scripts' ])

log.info(`Publishing ${chalk.black(`${packageJson.name}@${packageJson.version}`)} to npm...`)
isDryRun && log.warn('Dry run (will not contact npm)')

log(`Creating ${chalk.black('dist/')} directory...`)
all(
  attempt(() => remove(dist())),
  must(() => fs.mkdirSync(dist()))
)

log(`Writing bundle for ${chalk.black(packageJson.main)}...`)
createBundle(ENTRY_POINT, dist(packageJson.main))
  .then(() => {
    log(`Preparing ${chalk.black('package.json')}...`)
    R.pipe(
      omitDevelopmentKeys,
      R.curryN(3, JSON.stringify)(R.__, null, '  '),
      must(write(dist('package.json')))
    )(packageJson)

    log(`Copying README.md...`)
    must(copy)(path.join(PATH_REPO_ROOT, 'README.md'), dist('README.md'))

    log(`Publishing to npm...`)
    isDryRun && log.warn('Dry run: skipped publish...')
    R.ifElse(Boolean)
      (() => log.info('Finished dry run.'))
      (must(
        () => execSync('npm publish', { cwd: dist() })
      ))
      (isDryRun)
  })

  .catch(err => die(`Failed to write bundle: ${err.message}`))

function createBundle (target, destination) {
  return rollup.rollup({
    entry: target,
    plugins: [
      nodeResolve({
        jsnext: true,
      }),
      commonjs({
        sourcemap: false,
      }),
    ]
  }).then(bundle => {
    return bundle.write({
      format: 'cjs',
      dest: destination,
    })
  })
}
