
def _parse_external_username(user_token):
    identity_provider = user_token.get('identity_provider')
    if identity_provider == 'idir':
        return user_token.get('idir_username')
    elif identity_provider == 'bceidbusiness':
        return user_token.get('bceid_username')
    raise Exception('Unknown or missing identity provider.')
