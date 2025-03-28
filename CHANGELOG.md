# CHANGELOG

## 2025-05-28

Updated audit script to take JSON input to filter by Actions and commits.

## 2025-05-20

Added script to allow decoding secrets from workflows affected by a particular set of compromises in March 2025.

Made searching for Actions downloads more efficient. The search now stops after any consecutive lines seen that show an Action was downloaded, and avoids searching the rest of the log file.

## 2025-05-18

Added searching for logs in the top level `0_` file, if the `1_Set up job.txt` is no longer available in the logs zip file
