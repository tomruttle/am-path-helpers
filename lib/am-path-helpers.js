// @flow

import pathToRegexp from 'path-to-regexp';
import qs from 'qs';

export type ParamsType = { [paramName: string]: string };

export default function getPathHelpers(routesMap: { [routeName: string]: { path?: string, paths?: Array<string> } }) {
  if (!routesMap) {
    throw new Error('No routes provided.');
  }

  function getPaths(routeName) {
    const { path, paths } = routesMap[routeName];

    let routePaths = [];

    if (Array.isArray(paths) && paths.length > 0) {
      routePaths = paths;
    } else if (path) {
      routePaths = [path];
    }

    if (routePaths.length === 0) {
      throw new Error(`Route ${routeName} has no valid paths specified.`);
    }

    return routePaths;
  }

  function parsePath(path) {
    return pathToRegexp.parse(path)
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);
  }

  const pathParams = Object.keys(routesMap)
    .reduce((evaluatedPaths, routeName) => ({ ...evaluatedPaths, [routeName]: getPaths(routeName).map(parsePath) }), {});

  const pathCheckers = Object.keys(routesMap)
    .reduce((evaluatedPaths, routeName) => ({ ...evaluatedPaths, [routeName]: getPaths(routeName).map((path) => pathToRegexp(path)) }), {});

  function evalPathParams(routeName: string, path: string): ?ParamsType {
    const pathChecker = pathCheckers[routeName];

    if (!Array.isArray(pathChecker)) {
      throw new Error(`${routeName} not found in routes`);
    }

    return pathChecker.reduce((evaulatedParams, checker, index) => {
      if (evaulatedParams) {
        return evaulatedParams;
      }

      const match = checker.exec(path);

      if (!match) {
        return evaulatedParams;
      }

      const params = match
        .filter((token, idx) => idx > 0)
        .reduce((acc, token, idx) => ({ ...acc, [pathParams[routeName][index][idx]]: token }), {});

      return params;
    }, null);
  }

  return {
    getRouteName(parentState: { resource: string }): ?string {
      if (typeof parentState.resource !== 'string') {
        throw new Error('Resource not provided.');
      }

      const [path] = parentState.resource.split('?');
      return Object.keys(pathCheckers).find((routeName) => pathCheckers[routeName].find((checker) => checker.exec(path)));
    },

    getAdditionalState(parentState: { resource: string, route: ?{ name: string } }): { params: ParamsType, query: ParamsType } {
      const { resource, route } = parentState;

      if (typeof resource !== 'string') {
        throw new Error('Resource not provided.');
      }

      const [path, search] = resource.split('?');

      return {
        params: (route && evalPathParams(route.name, path)) || {},
        query: qs.parse(search),
      };
    },
  };
}
