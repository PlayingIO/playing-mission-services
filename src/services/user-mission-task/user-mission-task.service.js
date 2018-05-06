import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-mission-task.hooks';
import { walkThroughTasks } from '../../helpers';

const debug = makeDebug('playing:mission-services:user-missions/tasks');

const defaultOptions = {
  name: 'user-missions/tasks'
};

export class UserMissionTaskService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * Get a list of all available tasks a player can play in a user mission
   */
  async find (params) {
    const userMission = params.userMission;
    const mission = userMission.mission;
    if (mission && mission.activities) {
      return walkThroughTasks(params.user, userMission.tasks)(mission.activities);
    } else {
      return [];
    }
  }
}

export default function init (app, options, hooks) {
  return new UserMissionTaskService(options);
}

init.Service = UserMissionTaskService;
