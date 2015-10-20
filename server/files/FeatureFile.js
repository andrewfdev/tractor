'use strict';

// Constants:
import constants from '../constants';

// Utilities:
import os from 'os';

// Dependencies:
import FeatureLexerFormatter from './utils/FeatureLexerFormatter';
import File from './File';
import gherkin from 'gherkin';
import StepDefinitionGenerator from './utils/StepDefinitionGenerator';

// Errors:
import TractorError from '../errors/TractorError';

export default class FeatureFile extends File {
    read () {
        return super.read()
        .then(() => {
            var formatter = new FeatureLexerFormatter();
            /* eslint-disable new-cap */
            var EnLexer = gherkin.Lexer('en');
            /* eslint-enable new-cap */
            var enLexer = new EnLexer(formatter);
            enLexer.scan(this.content);
            this.tokens = formatter.done();
        })
        .catch((error) => {
            console.error(error);
            throw new TractorError(`Lexing "${this.name}" failed.`, 400);
        });
    }

    save (data) {
        if (data) {
            data = data.replace(constants.FEATURE_NEWLINE, os.EOL);
            this.content = data;
        }
        return super.save()
        .then(() => {
            let generator = new StepDefinitionGenerator(this);
            return generator.generate();
        })
        .catch((error) => {
            console.error(error);
            throw new TractorError(`Generating step definitions from "${this.name}" failed.`, 400);
        });
    }
}
