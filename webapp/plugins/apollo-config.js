import { InMemoryCache, IntrospectionFragmentMatcher } from 'apollo-cache-inmemory'
import introspectionQueryResultData from './apollo-config/fragmentTypes.json'

const fragmentMatcher = new IntrospectionFragmentMatcher({
  introspectionQueryResultData,
})

export default ({ app }) => {
  const backendUrl = process.env.GRAPHQL_URI || 'http://localhost:4000'

  return {
    wsEndpoint: 'ws://localhost:4000/graphql', // optional
    httpEndpoint: process.server ? backendUrl : '/api',
    httpLinkOptions: {
      credentials: 'same-origin',
    },
    credentials: true,
    tokenName: 'human-connection-token',
    persisting: false,
    websocketsOnly: true,
    cache: new InMemoryCache({ fragmentMatcher }),
  }
}
