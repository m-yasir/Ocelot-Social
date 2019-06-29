import { neo4jgraphql } from 'neo4j-graphql-js'
import fileUpload from './fileUpload'
import bcrypt from 'bcryptjs'
import { neode } from '../../bootstrap/neo4j'
import { UserInputError } from 'apollo-server'

const instance = neode()

export const createUser = async ({ args }) => {
  args.password = await bcrypt.hashSync(args.password, 10)
  try {
    const user = await instance.create('User', args)
    return user.toJson()
  } catch(e) {
    throw new UserInputError(e.message)
  }
}

const _has = (resolvers, {key, connection}, { returnType }) => {
  return async (parent, params, context, resolveInfo) => {
    if (typeof parent[key] !== 'undefined') return parent[key]
    const { id } = parent
    const statement = `MATCH(u:User {id: {id}})${connection} RETURN related`
    const result = await instance.cypher(statement, { id })
    let response = result.records.map(r => r.get('related').properties)
    if (returnType === 'object') response = response[0] || null
    return response
  }
}

export const hasMany = (obj) => {
  const resolvers = {}
  for (const [key, connection] of Object.entries(obj)) {
    resolvers[key] = _has(resolvers, {key, connection}, { returnType: 'iterable' })
  }
  return resolvers
}

export const hasOne = (obj) => {
  const resolvers = {}
  for (const [key, connection] of Object.entries(obj)) {
    resolvers[key] = _has(resolvers, {key, connection}, { returnType: 'object' })
  }
  return resolvers
}

export default {
  Mutation: {
    UpdateUser: async (object, args, context, resolveInfo) => {
      args = await fileUpload(args, { file: 'avatarUpload', url: 'avatar' })
      try {
        let user = await instance.find('User', args.id)
        await user.update(args)
        return user.toJson()
      } catch(e) {
        throw new UserInputError(e.message)
      }
    },
    CreateUser: async (object, args, context, resolveInfo) => {
      args = await fileUpload(args, { file: 'avatarUpload', url: 'avatar' })
      return createUser({ args })
    },
    DeleteUser: async (object, params, context, resolveInfo) => {
      const { resource } = params
      const session = context.driver.session()

      if (resource && resource.length) {
        await Promise.all(
          resource.map(async node => {
            await session.run(
              `
            MATCH (resource:${node})<-[:WROTE]-(author:User {id: $userId})
            SET resource.deleted = true
            RETURN author`,
              {
                userId: context.user.id,
              },
            )
          }),
        )
        session.close()
      }
      return neo4jgraphql(object, params, context, resolveInfo, false)
    },
  },
  User: {
    ...hasOne({
      invitedBy:            '<-[:INVITED]-(related:User)',
      disabledBy:           '<-[:DISABLED]-(related:User)',
    }),
    ...hasMany({
      followedBy:           '<-[:FOLLOWS]-(related:User)',
      following:            '-[:FOLLOWS]->(related:User)',
      friends:              '-[:FRIENDS]-(related:User)',
      blacklisted:          '-[:BLACKLISTED]->(related:User)',
      socialMedia:          '-[:OWNED]->(related:SocialMedia)',
      contributions:        '-[:WROTE]->(related:Post)',
      comments:             '-[:WROTE]->(related:Comment)',
      shouted:              '-[:SHOUTED]->(related:Post)',
      organizationsCreated: '-[:CREATED_ORGA]->(related:Organization)',
      organizationsOwned:   '-[:OWNING_ORGA]->(related:Organization)',
      categories:           '-[:CATEGORIZED]->(related:Category)',
      badges:               '-[:REWARDED]->(related:Badge)'
    })
  }
}
