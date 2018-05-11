import assert from 'assert';
import makeDebug from 'debug';
import { Service, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import MissionModel from '../../models/mission.model';
import defaultHooks from './mission.hooks';

const debug = makeDebug('playing:mission-services:missions');

const defaultOptions = {
  name: 'missions'
};

export class MissionService extends Service {
  constructor (options) {
    options = fp.assignAll(defaultOptions, options);
    super(options);
  }

  setup (app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }
}

export default function init (app, options, hooks) {
  options = { ModelName: 'mission', ...options };
  return createService(app, MissionService, MissionModel, options);
}

init.Service = MissionService;
