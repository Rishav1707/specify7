# js_src

The root directory for the front-end ecosystem.

## Documentation

Many folders have a README.md file that provides context specific documentation.

Additionally, files have TSDoc comments at the top and before function
declarations where applicable.

## Configuring development environment

### Configuring Git

### GitIgnore

IDE specific and OS specific files that git should ignore have no place in the
project's [`.gitignore`](../../../.gitignore) file.

Instead, you should use a system-wide `.gitignore_global` for files specific to
your development environment.

For example, I used to following
[`.gitignore_global`](https://github.com/maxxxxxdlp/dotfiles/blob/main/git/.gitignore_global)
for my setup (PyCharm, Vim, macOS, Nohup)

Just create a `~/.gitignore_global` file and run the following bash command:

```bash
git config --global core.excludesfile ~/.gitignore_global
```

#### Storing credentials

In order to commit changes, Git needs to connect to your GitHub account.

This can be achieved by
[creating a GitHub authentication token](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

The token needs to have the `repo` and `workflow` permissions.

Then, run this in bash:

```bash
git config credential.helper store
```

The next time you run `git push`, it will ask for your GitHub username and the
authentication token you created

#### Rebase on pull

Change the git pull strategy to rebase commits instead of creating needless
merge commits:

```bash
git config --global pull.rebase true
```

### Plugins

The following linters and formatters are used extensively in the process of
development. Many IDEs have plugins for closer integration.

- Prettier

  Opinionated code formatter.

  Config file and plugins are loaded from the
  [`@maxxxxxdlp/prettier-config`](https://www.npmjs.com/package/@maxxxxxdlp/prettier-config)
  npm package.

  Configure your IDE to run Prettier on the following files:

  ```
  {\*_/_,\*}.{ts,tsx,jsx,xml,json,md,yaml,yml}
  ```

- ESLint

  Highly customizable code linter

  Config file is located in [`./.eslintrc`](./.eslintrc.js). The config file
  get's most rules and plugins from
  [@maxxxxxdlp/eslint-config](https://www.npmjs.com/package/@maxxxxxdlp/eslint-config)

  Configure your IDE to run ESLint on the following files:

  ```
  {**/*,*}.{ts,tsx,jsx,xml,json,md,css,html,yaml,yml}
  ```

- TypeScript

  Type checking

  Config file is located in [`./tsconfig.json`](./tsconfig.json).

  Configure your IDE to get all settings from that file. No additional
  configuration is required.
