import assert from 'assert';
import makeDebug from 'debug';
import { Service, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import MissionDesignModel from '../../models/mission-design.model';
import defaultHooks from './mission-design.hooks';

const debug = makeDebug('playing:mission-services:mission-designs');

const defaultOptions = {
  name: 'mission-designs'
};

export class MissionDesignService extends Service {
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
  options = { ModelName: 'mission-design', ...options };
  return createService(app, MissionDesignService, MissionDesignModel, options);
}

init.Service = MissionDesignService;
