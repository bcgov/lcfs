# Cleanup unused/expired images in Openshift Image Registry

## Context

We recived alert emails about the image registry in the Silver cluster of the Private Cloud OpenShift platform being almost full. The image registry is a critical component for our development and deployment processes, as it stores the container images that are used by our applications. When the image registry is full, it can cause disruptions to our development and deployment activities, as teams may be unable to push new images or access existing images.

LCFS project has four namesapces on Openshift: licensePlate-tools, licensePlate-dev, licensePlate-test and licensePlate-prod. All of these namespaces are using quite some spaces in the image registry, which is a shared resource as describe above.

LCFS license plate is store in Openshift secret OPENSHIFT_NAMESPACE_PLATE.

## Goal

Create a workflow to:

- Identify and clean up unused or expired images in all four LCFS Openshift namespaces, but I'd like to keep three most recent release versions of each image. This will help free up space in the image registry, ensuring that other product teams can continue to push new images without interruption. Please focus on two image streams: lcfs-backend and lcfs-frontend.

- Clean up expired build configs and builds in the licensePlate-tools namespace. This will help improve the developer experience by reducing clutter and making it easier for developers to find the relevant build configs and builds.

## Steps to Achieve the Goal

- Create a callable workflow job named cleanup-images-template. The job will take the environment string as an input parameter. There are two outputs of the job: lcfs-backend-tags-to-keep and lcfs-frontend-tags-to-keep. Make sure the tags in each output has no duplicates.The job will perform the following steps:
  - Refferece the job install-oc in dev-ci.yaml workflow to install oc cli tool. Use redhat-actions/oc-login@v1.3 to login to Openshift licensePlate-<environment> namespace.
  - Identify the current images used by deployments lcfs-backend-<environment> and lcfs-frontend-<environment>, mark them as keep
  - Identify the most recent three release versions of each image, and mark them as keep. The image tags use semantic versioning plus timestamp, the release versions are in format of <major>.<minor>.<patch>-<timestamp>, for example, 1.2.0-20240614165335. Please make sure to identify the release versions correctly based on the image tags.
  - Delete the images which are not marked as keep, and make sure to delete the corresponding image stream tags as well. Please make sure to clean up the images and image stream tags correctly to avoid any potential issues with the deployments.

- Create another workflow file named cleanup-images.yaml and do the following steps:
  - Call the cleanup-images-template job for each of the four environments: dev, test and prod.
  - So far there are quite some images marked as keep, go to the licensePlate-tools namespace, and identify the images which are not same as the images marked as keep in the other three namespaces, and delete those images and corresponding image stream tags.
  - Go to the licensePlate-tools namespace, only keep the running builds and associated build configs and delete the expired builds and build configs. The expired builds and build configs are those which are not in running status and have been created for more than 7 days.

## Expected Outcome

- A workflow file named cleanup-imagses.yaml is created in .github/workflows directory, and the workflow can be triggered manually or run at 1am PST time every Thursday. When the workflow is executed, it will perform the cleanup of unused/expired images and expired build configs and builds as described in the steps above.
- Unused or expired images in all four Openshift namespaces are cleaned up, with the running and three most recent release versions of each image retained.
- Expired build configs and builds in the licensePlate-tools namespace are deleted, improving the developer experience by reducing clutter.
- The image registry has more free space, allowing other product teams to push new images without interruption.
