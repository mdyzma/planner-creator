// Self-hosted CI/CD (docs/operations/deploy-subdomain.md, "Jenkins and Gitea"): the same checks
// as .github/workflows/ci.yml, then a deploy of the tested commit to the Proxmox container.
//
// Jenkins settings (Manage Jenkins → System → Global properties → Environment variables):
//   YAPCO_DEPLOY_HOST  the container's address, e.g. yapco.lan or 192.168.1.50 (empty: no deploy)
//   YAPCO_REPO         what the container fetches, e.g. http://gitea.lan:3000/mdyzma/yapco.git
// Credentials: an "SSH Username with private key" with the id yapco-deploy (user root).
pipeline {
  // A plain agent instead: `agent any`, with Node 24 and Chromium installed on it, and
  // CHROME_PATH pointing to Chromium.
  agent {
    docker {
      image 'node:24-bookworm'
      args '-u root'
    }
  }

  options {
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  // Gitea pull-mirrors GitHub; poll it, since mirror syncs may not send webhooks.
  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    CI = 'true'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    CHROME_PATH = '/usr/bin/chromium'
  }

  stages {
    stage('Set up') {
      steps {
        sh '''
          apt-get update -qq
          DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium fonts-dejavu-core fonts-liberation openssh-client >/dev/null
          corepack enable
          pnpm install --frozen-lockfile
        '''
      }
    }

    stage('Checks') {
      steps {
        sh 'pnpm lint'
        sh 'pnpm format:check'
        sh 'pnpm typecheck'
        sh 'pnpm test'
      }
    }

    stage('Build') {
      steps {
        sh 'pnpm build'
      }
    }

    stage('PDF and page checks in Chromium') {
      steps {
        sh 'pnpm --filter @planner/export-node test:e2e'
      }
    }

    stage('Deploy') {
      when {
        allOf {
          expression { env.BRANCH_NAME == null || env.BRANCH_NAME == 'main' }
          expression { return (env.YAPCO_DEPLOY_HOST ?: '').trim() != '' }
        }
      }
      steps {
        sshagent(credentials: ['yapco-deploy']) {
          // Runs the install script from this checkout, for exactly the commit tested above.
          sh '''
            ssh -o StrictHostKeyChecking=accept-new "root@$YAPCO_DEPLOY_HOST" \
              "YAPCO_REPO='${YAPCO_REPO:-https://github.com/mdyzma/yapco.git}' YAPCO_COMMIT='$GIT_COMMIT' sh -s" \
              < deploy/proxmox/install.sh
          '''
        }
      }
    }
  }

  post {
    always {
      // The workspace is written as root inside the container; hand it back before cleaning.
      sh 'chown -R "$(stat -c %u:%g .)" . || true'
      deleteDir()
    }
  }
}
