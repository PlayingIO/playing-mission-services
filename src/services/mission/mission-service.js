import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import MissionModel from '~/models/mission-model';
import defaultHooks from './mission-hooks';

const debug = makeDebug('playing:mission-services:missions');

const defaultOptions = {
  name: 'missions'
};

class MissionService extends Service {
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
  options = Object.assign({ ModelName: 'mission' }, options);
  return createService(app, MissionService, MissionModel, options);
}

init.Service = MissionService;
