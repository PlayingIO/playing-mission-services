import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';

import defaultHooks from './user-mission-performer.hooks';

const debug = makeDebug('playing:mission-services:user-missions/performers');

const defaultOptions = {
  name: 'user-missions/performers'
};

export class UserMissionPerformerService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }
}

export default function init (app, options, hooks) {
  return new UserMissionPerformerService(options);
}

init.Service = UserMissionPerformerService;
