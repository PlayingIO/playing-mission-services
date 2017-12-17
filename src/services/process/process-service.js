import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import ProcessModel from '~/models/process-model';
import defaultHooks from './process-hooks';

const debug = makeDebug('playing:processes-services:processes');

const defaultOptions = {
  name: 'processes'
};

class ProcessService extends Service {
  constructor(options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup(app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }
}

export default function init(app, options, hooks) {
  options = Object.assign({ ModelName: 'process' }, options);
  return createService(app, ProcessService, ProcessModel, options);
}

init.Service = ProcessService;
