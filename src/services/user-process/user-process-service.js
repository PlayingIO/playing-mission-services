import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import UserProcessModel from '~/models/user-process-model';
import defaultHooks from './user-process-hooks';

const debug = makeDebug('playing:user-processes-services:user-processes');

const defaultOptions = {
  name: 'user-processes'
};

class UserProcessService extends Service {
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
  options = Object.assign({ ModelName: 'user-process' }, options);
  return createService(app, UserProcessService, UserProcessModel, options);
}

init.Service = UserProcessService;
