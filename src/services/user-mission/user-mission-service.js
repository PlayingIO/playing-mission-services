import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import UserMissionModel from '~/models/user-mission-model';
import defaultHooks from './user-mission-hooks';

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions'
};

class UserMissionService extends Service {
  constructor(options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup(app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  create(data, params) {
    assert(data.mission, 'data.mission not provided.');
    assert(data.access, 'data.access not provided.');
    assert(data.owner, 'data.owner not provided.');
    assert(params.user, 'params.user not provided');

    const svcMissions = this.app.service('missions');

    const getMission = (id) => svcMissions.get(id);

    return getMission(data.mission).then(mission => {
      assert(mission, 'data.mission is not exists.');
      data['$inc'] = { loop: 1 };
      data.status = 'ready';
      const defaultLane = fp.find(fp.propEq('default', true), mission.lanes || []);
      if (defaultLane) {
        data.performers = {
          user: data.owner,
          lanes: [{ lane: defaultLane.name, role: 'player' }]
        };
      }
      return super._upsert(null, data, { query: {
        mission: data.mission,
        owner: data.owner
      }}).then(result => {
        return result;
      });
    });
  }
}

export default function init(app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
