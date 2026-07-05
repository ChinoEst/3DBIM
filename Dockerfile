FROM node:22 AS builder  
WORKDIR /app     
COPY . .   
RUN rm -f package-lock.json && npm install
RUN npm run build   

FROM nginx:alpine    
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/public/worker.mjs /usr/share/nginx/html/worker.mjs
RUN sed -i 's|application/javascript\s*js;|application/javascript js mjs;|' /etc/nginx/mime.types
EXPOSE 80