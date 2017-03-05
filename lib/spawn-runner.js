'use babel';

/* @flow */
import * as fs from 'fs';
import * as path from 'path';
import _ from 'lodash';
import os from 'os';
import { BufferedProcess } from 'atom';
/* flow-include
import type { TextEditor } from 'atom'
*/

export function run(textEditor/* :TextEditor*/) {
  return new Promise((resolve) => {
    let processOutput = `\u001b[1mTester Jest\u001b[0m${os.EOL}`;
    const fileName = textEditor.getPath();
    let outputFilePath = fileName;
    const projectPath = atom.project.relativizePath(fileName)[0];
    let cwd = projectPath;
    if (!(cwd)) {
      cwd = path.dirname(fileName);
    }
    const fileModified = textEditor.isModified();
    if (fileModified) {
      const outputDir = `${atom.getConfigDirPath()}/tester-jest`;
      if (!fs.existsSync(outputDir)) {
        fs.mkdir(outputDir);
      }
      outputFilePath = `${outputDir}/${path.basename(fileName)}`;
      fs.writeFileSync(outputFilePath, textEditor.getText());
    }
    function parseReporterOutput(outputString) {
      let output = '';
      const messages = [];
      _.forEach(_.split(outputString, os.EOL), (line) => {
        try {
          const summary = JSON.parse(line);
          if (_.has(summary, 'testResults[0].assertionResults') && summary.testResults[0].assertionResults.length > 0) {
            _.forEach(summary.testResults[0].assertionResults, (testResult) => {
              textEditor.scan(new RegExp(testResult.title.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')), (scanResult) => {
                messages.push({
                  state: testResult.status,
                  title: testResult.title,
                  error: _.get(testResult, 'failureMessages[0]'),
                  duration: summary.testResults[0].endTime - summary.testResults[0].startTime,
                  lineNumber: scanResult.row,
                  filePath: outputFilePath,
                });
              });
            });
          }
          // messages.push(outputEvent);
        } catch (e) {
          output += line.toString() + os.EOL;
        }
      });
      return { messages, output };
    }
    const args = _.union([outputFilePath, '--json'], atom.config.get('tester-jest.args'));
    const options = { cwd };
    const jestBinary = atom.config.get('tester-jest.binaryPath');
    const command = jestBinary !== '' ? jestBinary : `${atom.packages.resolvePackagePath('tester-jest')}/node_modules/.bin/jest`;
    processOutput += `\u001b[1mcommand:\u001b[0m ${command} ${args.join(' ')}${os.EOL}`;
    processOutput += `\u001b[1mcwd:\u001b[0m ${cwd}${os.EOL}`;
    const stdout = data => processOutput += data;
    const stderr = data => processOutput += data;
    const exit = () => resolve(parseReporterOutput(processOutput));
    const process = new BufferedProcess({ command, args, options, stdout, stderr, exit });

    process.onWillThrowError((errorObject) => {
      atom.notifications.addError('Tester is unable to locate the jest command. Please ensure process.env.PATH can access jest.');
      console.error('Tester Jest: ', errorObject);
    });
  });
}